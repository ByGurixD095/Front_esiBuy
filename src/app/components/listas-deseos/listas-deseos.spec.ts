import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
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
  const servicioFalso = {
    listar: vi.fn(),
    obtenerProductos: vi.fn(),
    eliminarProducto: vi.fn(),
    modificarLista: vi.fn(),
  };
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
    servicioFalso.eliminarProducto.mockReset();
    servicioFalso.modificarLista.mockReset();
  });

  it('muestra todas las listas del cliente', async () => {
    servicioFalso.listar.mockReturnValue(of(listasMock));
    const html = await crear();

    expect(html.querySelectorAll('.tarjeta-lista').length).toBe(2);
    expect(html.textContent).toContain('Para comprar');
    expect(html.textContent).toContain('Regalos');
    expect(html.querySelector('a[href="/listas-deseos/lista-2"]')).not.toBeNull();
  });

  it('permite modificar el nombre de una lista y actualiza la tarjeta', async () => {
    servicioFalso.listar.mockReturnValue(of(listasMock));
    const respuestaModificacion = new Subject<ListaDeseos>();
    servicioFalso.modificarLista.mockReturnValue(respuestaModificacion);
    const html = await crear();

    html.querySelector<HTMLButtonElement>('[aria-label="Modificar la lista Regalos"]')?.click();
    fixture.detectChanges();

    expect(html.querySelector('[role="dialog"]')).not.toBeNull();
    const input = html.querySelector<HTMLInputElement>('#nuevo-nombre-lista');
    expect(input?.value).toBe('Regalos');
    input!.value = 'Ideas de regalo';
    input!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.formularioNombre.controls.nombre.value).toBe(
      'Ideas de regalo',
    );
    html.querySelector<HTMLButtonElement>('.acciones-modal button:not(.boton-secundario)')?.click();
    fixture.detectChanges();

    expect(servicioFalso.modificarLista).toHaveBeenCalledWith('lista-2', 'Ideas de regalo');
    expect(fixture.componentInstance.listas()[1].nombre).toBe('Ideas de regalo');
    expect(html.textContent).toContain('Ideas de regalo');

    respuestaModificacion.next({ ...listasMock[1], nombre: 'Ideas de regalo' });
    respuestaModificacion.complete();
    fixture.detectChanges();

    expect(fixture.componentInstance.listas()[1].nombre).toBe('Ideas de regalo');
    expect(html.textContent).toContain('Ideas de regalo');
    expect(html.querySelector('[role="dialog"]')).toBeNull();
  });

  it('no envía un nombre en blanco al modificar la lista', async () => {
    servicioFalso.listar.mockReturnValue(of(listasMock));
    const html = await crear();

    html.querySelector<HTMLButtonElement>('[aria-label="Modificar la lista Regalos"]')?.click();
    fixture.detectChanges();
    const input = html.querySelector<HTMLInputElement>('#nuevo-nombre-lista')!;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('.acciones-modal button:not(.boton-secundario)')?.click();
    fixture.detectChanges();

    expect(servicioFalso.modificarLista).not.toHaveBeenCalled();
    expect(html.querySelector('[role="dialog"]')).not.toBeNull();
    expect(html.textContent).toContain('Escribe un nombre para la lista.');
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

  it('pide confirmación antes de eliminar el producto de la lista', async () => {
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
    servicioFalso.eliminarProducto.mockReturnValue(of(void 0));
    const html = await crear();
    fixture.componentInstance.cargar('lista-2');
    fixture.detectChanges();

    html.querySelector<HTMLButtonElement>('[aria-label="Eliminar Teclado de la lista"]')?.click();
    fixture.detectChanges();

    expect(html.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(html.textContent).toContain(
      '¿Seguro que quieres eliminar el producto de la lista de deseos?',
    );
    expect(html.textContent).toContain('«Teclado»');
    expect(servicioFalso.eliminarProducto).not.toHaveBeenCalled();

    html.querySelector<HTMLButtonElement>('.acciones-modal .boton-secundario')?.click();
    fixture.detectChanges();
    expect(html.querySelector('[role="alertdialog"]')).toBeNull();
    expect(servicioFalso.eliminarProducto).not.toHaveBeenCalled();

    html.querySelector<HTMLButtonElement>('[aria-label="Eliminar Teclado de la lista"]')?.click();
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('.acciones-modal .boton-peligro')?.click();
    fixture.detectChanges();

    expect(servicioFalso.eliminarProducto).toHaveBeenCalledWith('lista-2', 'producto-1');
    expect(fixture.componentInstance.productos()).toEqual([]);
    expect(html.textContent).toContain('Esta lista está vacía');
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
