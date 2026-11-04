import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Pedido, PedidosService } from '../../services/pedidos.service';
import { MarcoPagina } from '../marco-pagina/marco-pagina';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-mis-pedidos',
  imports: [MarcoPagina, RouterLink],
  templateUrl: './mis-pedidos.html',
  styleUrl: './mis-pedidos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisPedidos implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly pedidosService = inject(PedidosService);

  readonly pedidos = signal<Pedido[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly avisoAccion = signal('');
  readonly vista = signal<'activos' | 'historico'>('activos');
  readonly pedidoActualizando = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarPedidos();
  }

  cargarPedidos(): void {
    this.cargando.set(true);
    this.error.set('');
    const consulta = this.vista() === 'activos'
      ? this.pedidosService.listarActivos()
      : this.pedidosService.listarHistorico();
    consulta.subscribe({
      next: (pedidos) => {
        this.pedidos.set(pedidos);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.auth.errorMessage(error, 'No se han podido cargar tus pedidos.'));
        this.cargando.set(false);
      },
    });
  }

  cambiarVista(vista: 'activos' | 'historico'): void {
    if (vista === this.vista()) return;
    this.vista.set(vista);
    this.avisoAccion.set('');
    this.cargarPedidos();
  }

  puedeCancelar(pedido: Pedido): boolean {
    return ['EN_PROCESO', 'PAGADO'].includes(pedido.estado) &&
      !pedido.lineas.some((linea) => linea.enviado);
  }

  puedePagar(pedido: Pedido): boolean {
    return pedido.estado === 'EN_PROCESO';
  }

  puedeConfirmarEntrega(pedido: Pedido): boolean {
    return pedido.estado === 'TRAMITADO_ENVIADO' &&
      pedido.lineas.length > 0 &&
      pedido.lineas.every((linea) => linea.enviado);
  }

  cancelarPedido(pedido: Pedido): void {
    this.ejecutarAccion(
      pedido.id,
      this.pedidosService.cancelar(pedido.id),
      'No se ha podido cancelar el pedido.',
    );
  }

  pagarPedido(pedido: Pedido): void {
    this.ejecutarAccion(
      pedido.id,
      this.pedidosService.pagar(pedido.id),
      'No se ha podido confirmar el pago simulado.',
    );
  }

  confirmarEntrega(pedido: Pedido): void {
    this.ejecutarAccion(
      pedido.id,
      this.pedidosService.confirmarEntrega(pedido.id),
      'No se ha podido confirmar la entrega.',
    );
  }

  private ejecutarAccion(pedidoId: string, accion: Observable<Pedido>, fallback: string): void {
    if (this.pedidoActualizando()) return;
    this.pedidoActualizando.set(pedidoId);
    this.avisoAccion.set('');
    accion.subscribe({
      next: () => {
        this.pedidoActualizando.set(null);
        this.cargarPedidos();
      },
      error: (error: HttpErrorResponse) => {
        this.pedidoActualizando.set(null);
        this.avisoAccion.set(
          error.status === 409
            ? 'El estado del pedido ha cambiado. Hemos actualizado la lista; revisa las acciones disponibles.'
            : this.auth.errorMessage(error, fallback),
        );
        this.cargarPedidos();
      },
    });
  }

  formatearPrecio(precioCent: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(precioCent / 100);
  }

  formatearFecha(fecha: string | null): string {
    if (!fecha) return 'Fecha no disponible';
    const fechaPedido = new Date(fecha);
    if (Number.isNaN(fechaPedido.getTime())) return 'Fecha no disponible';
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(fechaPedido);
  }

  estadoLegible(estado: string): string {
    const etiquetas: Record<string, string> = {
      RECIBIDO: 'Recibido',
      EN_PROCESO: 'Pendiente de pago',
      PAGADO: 'Pagado · preparando envío',
      TRAMITADO_ENVIADO: 'Enviado · pendiente de entrega',
      FINALIZADO: 'Finalizado',
      CANCELADO: 'Cancelado',
    };
    return etiquetas[estado] ?? estado.replaceAll('_', ' ').toLowerCase();
  }
}
