import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { PedidosService } from '../../services/pedidos.service';
import { PedidosVendedor } from './pedidos-vendedor';

describe('PedidosVendedor', () => {
  let fixture: ComponentFixture<PedidosVendedor>;
  const service = { listarVendedor: vi.fn(), enviar: vi.fn() };
  const auth = { errorMessage: (_error: unknown, fallback: string) => fallback };

  async function crear(): Promise<void> {
    service.listarVendedor.mockReturnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [PedidosVendedor],
      providers: [
        provideRouter([]),
        { provide: PedidosService, useValue: service },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PedidosVendedor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    service.listarVendedor.mockReset();
    service.enviar.mockReset();
  });

  it('carga por defecto la cola activa del vendedor', async () => {
    await crear();

    expect(service.listarVendedor).toHaveBeenCalledWith(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No tienes pedidos en curso');
  });

  it('marca como enviadas las líneas asignadas a la tienda', async () => {
    service.listarVendedor.mockReturnValue(of([]));
    await crear();
    service.enviar.mockReturnValue(of({}));
    fixture.componentInstance.marcarEnviado({
      id: 'pedido-1',
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
      estado: 'PAGADO',
      fechaPedido: null,
    });

    expect(service.enviar).toHaveBeenCalledWith('pedido-1');
  });
});
