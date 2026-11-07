import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { Pedido, PedidosService } from '../../services/pedidos.service';
import { MisPedidos } from './mis-pedidos';

describe('MisPedidos', () => {
  let fixture: ComponentFixture<MisPedidos>;
  const pedidosServiceFalso = {
    listar: vi.fn(),
    listarActivos: vi.fn(),
    listarHistorico: vi.fn(),
    cancelar: vi.fn(),
    pagar: vi.fn(),
    confirmarEntrega: vi.fn(),
  };
  const authFalso = { errorMessage: (_error: unknown, fallback: string) => fallback };

  async function crear(pedidos: Pedido[]): Promise<void> {
    pedidosServiceFalso.listarActivos.mockReturnValue(of(pedidos));
    pedidosServiceFalso.listarHistorico.mockReturnValue(of(pedidos));
    await TestBed.configureTestingModule({
      imports: [MisPedidos],
      providers: [
        provideRouter([]),
        { provide: PedidosService, useValue: pedidosServiceFalso },
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MisPedidos);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const html = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    pedidosServiceFalso.listar.mockReset();
    pedidosServiceFalso.listarActivos.mockReset();
    pedidosServiceFalso.listarHistorico.mockReset();
    pedidosServiceFalso.cancelar.mockReset();
    pedidosServiceFalso.pagar.mockReset();
    pedidosServiceFalso.confirmarEntrega.mockReset();
  });

  it('muestra el estado vacío y un acceso al catálogo cuando no hay pedidos', async () => {
    await crear([]);

    expect(html().textContent).toContain('No tienes pedidos en curso');
    expect(html().querySelector('a[href="/products"]')).not.toBeNull();
  });

  it('muestra la copia histórica del producto, el estado, el pago y los datos de envío', async () => {
    await crear([
      {
        id: 'pedido-42',
        lineas: [
          {
            productoId: 'producto-1',
            nombre: 'Mochila',
            referencia: 'MCH-1',
            urlImagen: null,
            enviado: false,
            precioUnitarioCent: 2599,
            cantidad: 2,
            subtotalCent: 5198,
          },
        ],
        direccionEnvio: {
          nombreCompleto: 'Ana García',
          direccion: 'Calle Mayor 1',
          ciudad: 'Madrid',
          provincia: 'Madrid',
          codigoPostal: '28001',
          pais: 'España',
          telefono: '+34600000000',
        },
        metodoPagoId: 'pago-1',
        tipoMetodoPago: 'TARJETA',
        aliasMetodoPago: 'Visa personal',
        referenciaMetodoPago: '**** 1234',
        totalCent: 5198,
        estado: 'RECIBIDO',
        fechaPedido: '2026-10-25T13:30:00',
      },
    ]);

    expect(html().textContent).toContain('pedido-42');
    expect(html().textContent).toContain('Mochila');
    expect(html().textContent).toContain('Recibido');
    expect(html().textContent).toContain('Visa personal');
    expect(html().textContent).toContain('Ana García');
    expect(html().textContent).toContain('51,98');
  });

  it('separa pedidos activos e históricos y actualiza la lista al cambiar de pestaña', async () => {
    await crear([]);
    pedidosServiceFalso.listarHistorico.mockReturnValue(of([]));

    html().querySelector<HTMLButtonElement>('[role="tab"]:nth-child(2)')?.click();
    fixture.detectChanges();

    expect(pedidosServiceFalso.listarHistorico).toHaveBeenCalled();
    expect(html().textContent).toContain('Aún no tienes pedidos históricos');
  });

  it('solo permite confirmar la entrega cuando todas las líneas están enviadas', async () => {
    const pedido: Pedido = {
      id: 'pedido-1',
      lineas: [
        {
          productoId: 'p1',
          nombre: 'Producto',
          referencia: 'P1',
          urlImagen: null,
          enviado: true,
          precioUnitarioCent: 100,
          cantidad: 1,
          subtotalCent: 100,
        },
      ],
      direccionEnvio: {
        nombreCompleto: 'Ana García',
        direccion: 'Calle Mayor 1',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28001',
        pais: 'España',
        telefono: '+34600000000',
      },
      metodoPagoId: 'pago-1',
      tipoMetodoPago: 'TARJETA',
      aliasMetodoPago: 'Visa',
      referenciaMetodoPago: '**** 1234',
      totalCent: 100,
      estado: 'TRAMITADO_ENVIADO',
      fechaPedido: null,
    };
    await crear([pedido]);
    pedidosServiceFalso.confirmarEntrega.mockReturnValue(of({ ...pedido, estado: 'FINALIZADO' }));

    expect(fixture.componentInstance.puedeConfirmarEntrega(pedido)).toBe(true);
    fixture.componentInstance.confirmarEntrega(pedido);
    fixture.detectChanges();

    expect(pedidosServiceFalso.confirmarEntrega).toHaveBeenCalledWith('pedido-1');
  });

  it('ofrece pago simulado solo para pedidos pendientes de pago', async () => {
    const pedido: Pedido = {
      id: 'pedido-pendiente',
      lineas: [],
      direccionEnvio: {
        nombreCompleto: 'Ana García',
        direccion: 'Calle Mayor 1',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28001',
        pais: 'España',
        telefono: '+34600000000',
      },
      metodoPagoId: 'pago-1',
      tipoMetodoPago: 'TARJETA',
      aliasMetodoPago: 'Visa',
      referenciaMetodoPago: '**** 1234',
      totalCent: 100,
      estado: 'EN_PROCESO',
      fechaPedido: null,
    };
    await crear([pedido]);
    pedidosServiceFalso.pagar.mockReturnValue(of({ ...pedido, estado: 'PAGADO' }));

    expect(fixture.componentInstance.puedePagar(pedido)).toBe(true);
    fixture.componentInstance.pagarPedido(pedido);
    expect(pedidosServiceFalso.pagar).toHaveBeenCalledWith('pedido-pendiente');
  });
});
