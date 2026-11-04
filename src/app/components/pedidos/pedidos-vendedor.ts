import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { Pedido, PedidosService } from '../../services/pedidos.service';
import { MarcoPagina } from '../marco-pagina/marco-pagina';

@Component({
  selector: 'app-pedidos-vendedor',
  imports: [MarcoPagina, RouterLink],
  templateUrl: './pedidos-vendedor.html',
  styleUrl: './mis-pedidos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PedidosVendedor implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly pedidosService = inject(PedidosService);

  readonly pedidos = signal<Pedido[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly avisoAccion = signal('');
  readonly historico = signal(false);
  readonly pedidoActualizando = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarPedidos();
  }

  cargarPedidos(): void {
    this.cargando.set(true);
    this.error.set('');
    this.pedidosService.listarVendedor(this.historico()).subscribe({
      next: (pedidos) => {
        this.pedidos.set(pedidos);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.auth.errorMessage(error, 'No se han podido cargar tus pedidos de venta.'));
        this.cargando.set(false);
      },
    });
  }

  cambiarVista(historico: boolean): void {
    if (historico === this.historico()) return;
    this.historico.set(historico);
    this.avisoAccion.set('');
    this.cargarPedidos();
  }

  puedeEnviar(pedido: Pedido): boolean {
    return !this.historico() &&
      pedido.estado === 'PAGADO' &&
      pedido.lineas.some((linea) => !linea.enviado);
  }

  marcarEnviado(pedido: Pedido): void {
    this.ejecutarAccion(
      pedido.id,
      this.pedidosService.enviar(pedido.id),
      'No se han podido marcar las líneas como enviadas.',
    );
  }

  estadoLegible(estado: string): string {
    const etiquetas: Record<string, string> = {
      RECIBIDO: 'Recibido · estado legado',
      EN_PROCESO: 'Pendiente de pago',
      PAGADO: 'Pendiente de envío',
      TRAMITADO_ENVIADO: 'Enviado',
      FINALIZADO: 'Finalizado',
      CANCELADO: 'Cancelado',
    };
    return etiquetas[estado] ?? estado.replaceAll('_', ' ').toLowerCase();
  }

  formatearPrecio(precioCent: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(precioCent / 100);
  }

  formatearFecha(fecha: string | null): string {
    if (!fecha) return 'Fecha no disponible';
    const fechaPedido = new Date(fecha);
    if (Number.isNaN(fechaPedido.getTime())) return 'Fecha no disponible';
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(fechaPedido);
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
            ? 'El estado del pedido ha cambiado. Hemos actualizado la cola; revisa las acciones disponibles.'
            : this.auth.errorMessage(error, fallback),
        );
        this.cargarPedidos();
      },
    });
  }
}
