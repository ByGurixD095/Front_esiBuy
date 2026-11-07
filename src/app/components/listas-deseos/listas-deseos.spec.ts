import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import {
  ListaDeseos,
  ListaDeseosApiError,
  ListaDeseosService,
} from '../../services/lista-deseos-service/lista-deseos';
import { ListasDeseos } from './listas-deseos';

const listasMock: ListaDeseos[] = [
  { id: 'lista-1', idCliente: 'cliente-1', nombre: 'Para comprar', productosIds: [] },
  { id: 'lista-2', idCliente: 'cliente-1', nombre: 'Regalos', productosIds: ['producto-1'] },
];

describe('ListasDeseos', () => {
  let fixture: ComponentFixture<ListasDeseos>;
  const servicioFalso = { listar: vi.fn(), obtenerProductos: vi.fn() };
  const authFalso = {
    isAuthenticated: () => true,
    hasRole: () => true,
  };

  async function crear(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [ListasDeseos],
      providers: [
        provideRouter([]),
        { provide: ListaDeseosService, useValue: servicioFalso },
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListasDeseos);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    servicioFalso.listar.mockReset();
    servicioFalso.obtenerProductos.mockReset();
  });

  it('muestra todas las listas del cliente', async () => {
    servicioFalso.listar.mockReturnValue(of(listasMock));
    const html = await crear();

    expect(html.querySelectorAll('.tarjeta-lista').length).toBe(2);
    expect(html.textContent).toContain('Para comprar');
    expect(html.textContent).toContain('Regalos');
    expect(html.querySelector('a[href="/listas-deseos/lista-2"]')).not.toBeNull();
  });

  it('muestra el estado vacío y ofrece crear una lista', async () => {
    servicioFalso.listar.mockReturnValue(of([]));
    const html = await crear();

    expect(html.textContent).toContain('Todavía no tienes listas de deseos');
    expect(html.querySelector('a[href="/listas-deseos/nueva"]')).not.toBeNull();
  });

  it('muestra los productos de la lista seleccionada y permite volver', async () => {
    servicioFalso.listar.mockReturnValue(of(listasMock));
    servicioFalso.obtenerProductos.mockReturnValue(
      of([
        {
          id: 'producto-1',
          nombre: 'Teclado',
          referencia: 'REF-1',
          numStock: 5,
          precioCent: 12500,
          categoriaId: 'tecnologia',
          categoria: 'Tecnología',
          urlImagen: null,
          descuento: 0,
          descuentoPremium: 0,
          activo: true,
        },
      ]),
    );
    const html = await crear();

    fixture.componentInstance.cargar('lista-2');
    fixture.detectChanges();

    expect(servicioFalso.obtenerProductos).toHaveBeenCalledWith('lista-2');
    expect(html.textContent).toContain('Regalos');
    expect(html.textContent).toContain('Teclado');
    expect(html.querySelector('.volver-listas')?.textContent).toContain(
      'Volver a todas las listas',
    );
  });

  it('indica cuando la lista seleccionada no tiene productos', async () => {
    servicioFalso.listar.mockReturnValue(of(listasMock));
    servicioFalso.obtenerProductos.mockReturnValue(of([]));
    const html = await crear();

    fixture.componentInstance.cargar('lista-1');
    fixture.detectChanges();

    expect(html.textContent).toContain('Esta lista está vacía');
  });

  it('muestra el error de carga y permite reintentar', async () => {
    servicioFalso.listar.mockReturnValue(
      throwError(() => new ListaDeseosApiError(500, 'No se han podido cargar tus listas.')),
    );
    const html = await crear();

    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      'No se han podido cargar tus listas.',
    );
    expect(html.querySelector('button')?.textContent).toContain('Reintentar');
  });
});
