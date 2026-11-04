import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Gestionar } from './gestionar';

describe('Gestionar', () => {
  let fixture: ComponentFixture<Gestionar>;

  async function crear(rol: 'CLIENTE' | 'VENDEDOR' | 'ADMINISTRADOR'): Promise<HTMLElement> {
    const authFalso = {
      isAuthenticated: () => true,
      hasRole: (roles: string[]) => roles.includes(rol),
    };
    await TestBed.configureTestingModule({
      imports: [Gestionar],
      providers: [provideRouter([]), { provide: AuthService, useValue: authFalso }],
    }).compileComponents();

    fixture = TestBed.createComponent(Gestionar);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('al cliente le ofrece Favoritos y nada de administración', async () => {
    const el = await crear('CLIENTE');

    expect(el.querySelector('a[href="/favoritos"]')?.textContent).toContain('Mis favoritos');
    expect(el.querySelector('a.opcion[href="/listas-deseos"]')?.textContent).toContain(
      'Mis listas de deseos',
    );
    expect(el.querySelector('a[href="/admin/usuarios"]')).toBeNull();
    expect(el.querySelector('a[href="/products/catalogo"]')).toBeNull();
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('al vendedor no le ofrece Favoritos', async () => {
    const el = await crear('VENDEDOR');

    expect(el.querySelector('a[href="/favoritos"]')).toBeNull();
    expect(el.querySelector('a[href="/listas-deseos"]')).toBeNull();
    expect(el.querySelector('a[href="/products/catalogo"]')).not.toBeNull();
  });

  it('al administrador le ofrece crear administradores y gestionar usuarios', async () => {
    const el = await crear('ADMINISTRADOR');

    expect(el.querySelector('a[href="/administradores/nuevo"]')).not.toBeNull();
    expect(el.querySelector('a[href="/admin/usuarios"]')).not.toBeNull();
    expect(el.querySelector('a[href="/favoritos"]')).toBeNull();
    expect(el.querySelector('a[href="/listas-deseos"]')).toBeNull();
  });
});
