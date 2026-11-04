import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { Categorias } from '../../services/categorias.service';
import { ListarCategorias } from './listar-categorias';

describe('ListarCategorias', () => {
  let fixture: ComponentFixture<ListarCategorias>;
  const servicioFalso = { listar: vi.fn(), eliminar: vi.fn(), actualizar: vi.fn() };
  const authFalso = { isAuthenticated: () => true, hasRole: () => true };

  async function crear(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ListarCategorias],
      providers: [
        provideRouter([]),
        { provide: Categorias, useValue: servicioFalso },
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListarCategorias);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const html = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    servicioFalso.listar.mockReset();
    servicioFalso.eliminar.mockReset();
    servicioFalso.actualizar.mockReset();
  });

  it('se crea y pide las categorías al servicio', async () => {
    servicioFalso.listar.mockReturnValue(of([]));
    await crear();

    expect(fixture.componentInstance).toBeTruthy();
    expect(servicioFalso.listar).toHaveBeenCalledOnce();
    expect(html().textContent).toContain('catálogo.');
  });

  it('muestra cada categoría con su nombre y el contador', async () => {
    servicioFalso.listar.mockReturnValue(
      of([
        { id: 'c1', nombre: 'Hogar' },
        { id: 'c2', nombre: 'Ropa' },
      ]),
    );
    await crear();

    const elementos = html().querySelectorAll('.elemento');
    expect(elementos.length).toBe(2);
    expect(elementos[0].textContent).toContain('Hogar');
    expect(elementos[1].textContent).toContain('Ropa');
    expect(html().textContent).toContain('2 categorías');
  });

  it('usa el singular cuando solo hay una categoría', async () => {
    servicioFalso.listar.mockReturnValue(of([{ id: 'c1', nombre: 'Hogar' }]));
    await crear();

    expect(html().textContent).toContain('1 categoría');
    expect(html().textContent).not.toContain('1 categorías');
  });

  it('muestra el estado vacío cuando no hay categorías', async () => {
    servicioFalso.listar.mockReturnValue(of([]));
    await crear();

    expect(html().textContent).toContain('Todavía no hay categorías');
    expect(html().querySelectorAll('.elemento').length).toBe(0);
  });

  it('ofrece un enlace para crear una categoría nueva', async () => {
    servicioFalso.listar.mockReturnValue(of([]));
    await crear();

    const enlace = html().querySelector('a[href="/admin/categorias/nueva"]');
    expect(enlace?.textContent).toContain('Nueva categoría');
  });

  it('muestra el error de permisos y permite reintentar', async () => {
    servicioFalso.listar.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );
    await crear();

    const alerta = html().querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('No se han podido cargar las categorías');

    servicioFalso.listar.mockReturnValue(of([{ id: 'c1', nombre: 'Hogar' }]));
    (alerta?.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(servicioFalso.listar).toHaveBeenCalledTimes(2);
    expect(html().querySelectorAll('.elemento').length).toBe(1);
  });

  it('avisa si no hay conexión con el servidor', async () => {
    servicioFalso.listar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    await crear();

    expect(html().querySelector('[role="alert"]')?.textContent).toContain(
      'No se ha podido conectar con el servidor',
    );
  });

  it('filtra categorías por nombre sin distinguir mayúsculas', async () => {
    servicioFalso.listar.mockReturnValue(
      of([
        { id: 'c1', nombre: 'Hogar' },
        { id: 'c2', nombre: 'Ropa' },
      ]),
    );
    await crear();

    const buscador = html().querySelector('.busqueda-categorias input') as HTMLInputElement;
    buscador.value = 'hog';
    buscador.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(html().querySelectorAll('.elemento').length).toBe(1);
    expect(html().textContent).toContain('Hogar');
    expect(html().querySelector('.contador')?.textContent).toContain('1 categoría');
    expect(html().querySelector('.contador')?.textContent).toContain('de 2');
  });

  it('pagina las categorías y vuelve a la primera página al buscar', async () => {
    servicioFalso.listar.mockReturnValue(
      of(Array.from({ length: 10 }, (_, indice) => ({
        id: `c${indice + 1}`,
        nombre: `Categoría ${indice + 1}`,
      }))),
    );
    await crear();

    expect(html().querySelectorAll('.elemento').length).toBe(8);
    expect(html().querySelector('.paginacion')?.textContent).toContain('Página 1 de 2');

    (html().querySelector('.paginacion button:last-child') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(html().querySelectorAll('.elemento').length).toBe(2);
    expect(html().querySelector('.paginacion')?.textContent).toContain('Página 2 de 2');

    const buscador = html().querySelector('.busqueda-categorias input') as HTMLInputElement;
    buscador.value = 'Categoría 1';
    buscador.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(html().querySelectorAll('.elemento').length).toBe(2);
    expect(html().querySelector('.paginacion')).toBeNull();
  });

  it('muestra un estado vacío cuando la búsqueda no encuentra categorías', async () => {
    servicioFalso.listar.mockReturnValue(of([{ id: 'c1', nombre: 'Hogar' }]));
    await crear();

    const buscador = html().querySelector('.busqueda-categorias input') as HTMLInputElement;
    buscador.value = 'jardín';
    buscador.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(html().querySelectorAll('.elemento').length).toBe(0);
    expect(html().textContent).toContain('No hay coincidencias');
  });

  describe('eliminar categoría (HU 30)', () => {
    const dosCategorias = [
      { id: 'c1', nombre: 'Hogar' },
      { id: 'c2', nombre: 'Ropa' },
    ];

    const botonEliminar = (nombre: string) =>
      html().querySelector(`button[aria-label="Eliminar la categoría ${nombre}"]`) as HTMLButtonElement;
    const dialogo = () => html().querySelector('dialog.confirmacion-dialogo');
    const pulsar = (selector: string) => {
      (html().querySelector(selector) as HTMLButtonElement).click();
      fixture.detectChanges();
    };

    beforeEach(() => servicioFalso.listar.mockReturnValue(of(dosCategorias)));

    it('muestra un botón Eliminar por cada categoría', async () => {
      await crear();

      expect(botonEliminar('Hogar')).toBeTruthy();
      expect(botonEliminar('Ropa')).toBeTruthy();
    });

    it('permite cambiar el nombre y conserva la categoría en la lista', async () => {
      servicioFalso.actualizar.mockReturnValue(of({ id: 'c1', nombre: 'Casa' }));
      await crear();
      (html().querySelector('button[aria-label="Modificar la categoría Hogar"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      const input = html().querySelector('.edicion input') as HTMLInputElement;
      input.value = 'Casa';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      (html().querySelector('.edicion button') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(servicioFalso.actualizar).toHaveBeenCalledWith('c1', { nombre: 'Casa' });
      expect(html().textContent).toContain('Casa');
      expect(html().textContent).not.toContain('Hogar');
      expect(html().textContent).toContain('La categoría se ha cambiado a «Casa».');
    });

    it('pide confirmación antes de eliminar y no llama al servicio todavía', async () => {
      await crear();
      botonEliminar('Hogar').click();
      fixture.detectChanges();

      expect(dialogo()?.textContent).toContain('¿Eliminar categoría?');
      expect(dialogo()?.textContent).toContain('Hogar');
      expect(servicioFalso.eliminar).not.toHaveBeenCalled();
    });

    it('cancelar cierra el diálogo y no elimina nada', async () => {
      await crear();
      botonEliminar('Hogar').click();
      fixture.detectChanges();
      pulsar('.confirmacion-cancelar');

      expect(dialogo()).toBeNull();
      expect(servicioFalso.eliminar).not.toHaveBeenCalled();
      expect(html().querySelectorAll('.elemento').length).toBe(2);
    });

    it('confirmar elimina la categoría, la quita de la lista y avisa', async () => {
      servicioFalso.eliminar.mockReturnValue(of(undefined));
      await crear();
      botonEliminar('Hogar').click();
      fixture.detectChanges();
      pulsar('.confirmacion-eliminar');

      expect(servicioFalso.eliminar).toHaveBeenCalledWith('c1');
      expect(dialogo()).toBeNull();
      expect(html().querySelectorAll('.elemento').length).toBe(1);
      expect(html().querySelector('[role="status"].esi-alerta--ok')?.textContent).toContain(
        'La categoría «Hogar» se ha eliminado.',
      );
    });

    it('si hay productos que la usan (409) muestra el mensaje y mantiene la categoría', async () => {
      servicioFalso.eliminar.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: {
                error: 'Conflict',
                message: 'No se puede eliminar la categoría porque hay productos que la usan',
              },
            }),
        ),
      );
      await crear();
      botonEliminar('Hogar').click();
      fixture.detectChanges();
      pulsar('.confirmacion-eliminar');

      expect(dialogo()?.textContent).toContain('No se puede eliminar todavía');
      expect(dialogo()?.textContent).toContain('Cambia esos productos a otra categoría');
      expect(dialogo()?.querySelector('[role="alert"]')?.textContent).toContain('productos que la usan');
      expect(html().querySelectorAll('.elemento').length).toBe(2);
      expect(dialogo()).not.toBeNull();
      expect(dialogo()?.querySelector('.confirmacion-eliminar')).toBeNull();

      pulsar('.confirmacion-cancelar');
      expect(dialogo()).toBeNull();
    });

    it('si la categoría ya no existe (404) avisa y la quita de la lista', async () => {
      servicioFalso.eliminar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      await crear();
      botonEliminar('Hogar').click();
      fixture.detectChanges();
      pulsar('.confirmacion-eliminar');

      expect(html().querySelector('[role="alert"]')?.textContent).toContain(
        'La categoría ya no existe',
      );
      expect(html().querySelectorAll('.elemento').length).toBe(1);
    });

    it('avisa de falta de permisos (403)', async () => {
      servicioFalso.eliminar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      await crear();
      botonEliminar('Ropa').click();
      fixture.detectChanges();
      pulsar('.confirmacion-eliminar');

      expect(html().querySelector('[role="alert"]')?.textContent).toContain(
        'No tienes permisos para eliminar categorías',
      );
      expect(html().querySelectorAll('.elemento').length).toBe(2);
    });

    it('avisa si no hay conexión (0)', async () => {
      servicioFalso.eliminar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
      await crear();
      botonEliminar('Ropa').click();
      fixture.detectChanges();
      pulsar('.confirmacion-eliminar');

      expect(html().querySelector('[role="alert"]')?.textContent).toContain(
        'No se ha podido conectar con el servidor',
      );
    });
  });
});
