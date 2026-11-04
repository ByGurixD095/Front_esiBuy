import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Producto } from '../../models/producto.model';
import { AuthService } from '../../services/auth.service';
import { Favoritos, FavoritosApiError } from '../../services/favoritos-service/favoritos';
import { MisFavoritos } from './favoritos';

function producto(id: string, nombre: string, extra: Partial<Producto> = {}): Producto {
  return {
    id,
    nombre,
    referencia: `REF-${id}`,
    numStock: 5,
    precioCent: 10000,
    descripcion: null,
    categoriaId: 'c-hogar',
    categoria: 'HOGAR',
    urlImagen: null,
    descuento: 0,
    descuentoPremium: 0,
    activo: true,
    ...extra,
  };
}

describe('MisFavoritos', () => {
  let fixture: ComponentFixture<MisFavoritos>;
  const servicioFalso = { listar: vi.fn(), marcar: vi.fn(), quitar: vi.fn() };
  const authFalso = {
    email: signal<string | null>('cliente@test.com'),
    isAuthenticated: () => true,
    hasRole: () => false,
  };

  async function crear(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [MisFavoritos],
      providers: [
        provideRouter([]),
        { provide: Favoritos, useValue: servicioFalso },
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MisFavoritos);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const html = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    servicioFalso.listar.mockReset();
    servicioFalso.quitar.mockReset();
  });

  it('se crea y pide los favoritos al servicio', async () => {
    servicioFalso.listar.mockReturnValue(of([]));
    await crear();

    expect(fixture.componentInstance).toBeTruthy();
    expect(servicioFalso.listar).toHaveBeenCalledOnce();
    expect(html().textContent).toContain('favoritos.');
  });

  it('muestra cada producto guardado con su precio', async () => {
    servicioFalso.listar.mockReturnValue(
      of([producto('p1', 'Lámpara'), producto('p2', 'Mesa', { precioCent: 20000, descuento: 50 })]),
    );
    await crear();

    const tarjetas = html().querySelectorAll('.tarjeta-favorito');
    expect(tarjetas.length).toBe(2);
    expect(tarjetas[0].textContent).toContain('Lámpara');
    expect(tarjetas[1].textContent).toContain('Mesa');
    expect(tarjetas[1].textContent).toContain('-50%');
    expect(html().textContent).toContain('2 productos guardados');
  });

  it('muestra el estado vacío con enlace al catálogo cuando no hay favoritos', async () => {
    servicioFalso.listar.mockReturnValue(of([]));
    await crear();

    expect(html().textContent).toContain('Todavía no tienes favoritos');
    expect(html().querySelector('a[href="/products"]')).not.toBeNull();
  });

  it('muestra el error y permite reintentar', async () => {
    servicioFalso.listar.mockReturnValueOnce(
      throwError(() => new FavoritosApiError(500, 'No se ha podido cargar tus favoritos. Inténtalo de nuevo más tarde.')),
    );
    await crear();

    const alerta = html().querySelector('.estado-error[role="alert"]');
    expect(alerta?.textContent).toContain('No se ha podido cargar tus favoritos');

    servicioFalso.listar.mockReturnValue(of([producto('p1', 'Lámpara')]));
    (alerta?.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(servicioFalso.listar).toHaveBeenCalledTimes(2);
    expect(html().querySelectorAll('.tarjeta-favorito').length).toBe(1);
  });

  it('quita un producto de la lista tras llamar al servicio', async () => {
    servicioFalso.listar.mockReturnValue(of([producto('p1', 'Lámpara'), producto('p2', 'Mesa')]));
    servicioFalso.quitar.mockReturnValue(of(undefined));
    await crear();

    (html().querySelector('.quitar') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(servicioFalso.quitar).toHaveBeenCalledWith('p1');
    const tarjetas = html().querySelectorAll('.tarjeta-favorito');
    expect(tarjetas.length).toBe(1);
    expect(tarjetas[0].textContent).toContain('Mesa');
  });

  it('mantiene el producto y avisa si no se puede quitar', async () => {
    servicioFalso.listar.mockReturnValue(of([producto('p1', 'Lámpara')]));
    servicioFalso.quitar.mockReturnValue(
      throwError(() => new FavoritosApiError(0, 'No se puede conectar con el servidor para quitar el producto de favoritos.')),
    );
    await crear();

    (html().querySelector('.quitar') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(html().querySelectorAll('.tarjeta-favorito').length).toBe(1);
    expect(html().querySelector('.aviso-error[role="alert"]')?.textContent).toContain('No se puede conectar');
  });
});
