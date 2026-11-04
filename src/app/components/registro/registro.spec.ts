import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { Categorias } from '../../services/categorias.service';
import { Registro as RegistroService } from '../../services/registro-service/registro';
import { AVATARES_VENDEDOR } from '../avatar-selector/avatar-selector';
import { RegistroComponent } from './registro';

describe('RegistroComponent', () => {
  let component: RegistroComponent;
  let fixture: ComponentFixture<RegistroComponent>;

  const servicioFalso = {
    registrarCliente: vi.fn(),
    registrarVendedor: vi.fn(),
  };
  const categoriasFalso = { listar: vi.fn() };
  const autenticacionFalsa = {
    login: vi.fn(),
    applyAuthenticationResponse: vi.fn(),
  };
  const routerFalso = {
    navigateByUrl: vi.fn().mockResolvedValue(true),
    navigate: vi.fn().mockResolvedValue(true),
  };
  const respuestaLoginOk = {
    accessToken: null,
    refreshToken: null,
    rol: 'CLIENTE',
    tipoCliente: null,
    mfaStatus: 'SUCCESS',
    email: 'ana@example.es',
    mfaSetupToken: null,
  };

  async function configurar(tipoRegistro: 'cliente' | 'vendedor'): Promise<void> {
    servicioFalso.registrarCliente.mockReset();
    servicioFalso.registrarVendedor.mockReset();
    categoriasFalso.listar.mockReset();
    categoriasFalso.listar.mockReturnValue(
      of([{ id: 'categoria-1', nombre: 'Hogar' }]),
    );
    autenticacionFalsa.login.mockReset();
    autenticacionFalsa.login.mockReturnValue(of(respuestaLoginOk));
    routerFalso.navigateByUrl.mockClear();
    routerFalso.navigate.mockClear();
    await TestBed.configureTestingModule({
      imports: [RegistroComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: { tipoRegistro } } } },
        { provide: RegistroService, useValue: servicioFalso },
        { provide: Categorias, useValue: categoriasFalso },
        { provide: AuthService, useValue: autenticacionFalsa },
        { provide: Router, useValue: routerFalso },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('valida los campos obligatorios de cliente y rechaza fechas futuras', async () => {
    await configurar('cliente');
    expect(component.form.valid).toBe(false);

    component.form.patchValue({
      nombre: 'Ana',
      apellidos: 'López',
      email: 'ana@example.es',
      contrasena: 'Clave123!',
      confirmarContrasena: 'Clave123!',
    });
    expect(component.form.valid).toBe(false);

    component.form.patchValue({
      dni: '12345678A',
      fechaNacimiento: '2099-01-01',
    });

    expect(component.form.valid).toBe(false);
    expect(component.form.controls.fechaNacimiento.errors).toHaveProperty('past');
  });

  it('envía los campos de cliente esperados y muestra el éxito', async () => {
    await configurar('cliente');
    servicioFalso.registrarCliente.mockReturnValue(of(respuestaLoginOk));
    component.form.patchValue({
      nombre: 'Ana',
      apellidos: 'López',
      email: 'ana@example.es',
      contrasena: 'Clave123!',
      confirmarContrasena: 'Clave123!',
      telefono: '600123456',
      imagenPerfil: 'https://example.es/ana.png',
      dni: '12345678A',
      fechaNacimiento: '2000-01-01',
    });

    component.enviar();
    await fixture.whenStable();

    expect(servicioFalso.registrarCliente).toHaveBeenCalledWith({
      nombre: 'Ana',
      apellidos: 'López',
      email: 'ana@example.es',
      contrasena: 'Clave123!',
      confirmarContrasena: 'Clave123!',
      telefono: '600123456',
      imagenPerfil: 'https://example.es/ana.png',
      dni: '12345678A',
      fechaNacimiento: '2000-01-01',
    });
    expect(component.mensajeExito()).toContain('inicio de sesión completado');
    expect(routerFalso.navigate).toHaveBeenCalledWith(['/products']);
  });

  it('avisa de que la cuenta queda pendiente de activación y no inicia sesión', async () => {
    await configurar('cliente');
    autenticacionFalsa.applyAuthenticationResponse.mockClear();
    component.form.patchValue({
      nombre: 'Ana',
      apellidos: 'López',
      email: 'ana@example.es',
      contrasena: 'Clave123!',
      confirmarContrasena: 'Clave123!',
      dni: '12345678A',
      fechaNacimiento: '2000-01-01',
    });
    servicioFalso.registrarCliente.mockReturnValue(
      of({ ...respuestaLoginOk, mfaStatus: 'PENDING_ACTIVATION' }),
    );

    component.enviar();
    await fixture.whenStable();

    expect(component.mensajeExito()).toContain('Un administrador debe activarla');
    expect(autenticacionFalsa.login).not.toHaveBeenCalled();
    expect(autenticacionFalsa.applyAuthenticationResponse).not.toHaveBeenCalled();
    expect(routerFalso.navigate).not.toHaveBeenCalled();
  });

  it('valida y envía los campos obligatorios de vendedor', async () => {
    await configurar('vendedor');
    expect(categoriasFalso.listar).toHaveBeenCalledOnce();
    expect(
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLSelectElement>(
          '#categoriaPrincipalId option',
        ),
      ).map((opcion) => opcion.textContent?.trim()),
    ).toEqual(['Selecciona una categoría', 'Hogar']);
    expect(component.form.valid).toBe(false);
    component.form.patchValue({
      nombre: 'Ana',
      apellidos: 'López',
      email: 'ana@example.es',
      contrasena: 'Clave123!',
      confirmarContrasena: 'Clave123!',
    });
    expect(component.form.valid).toBe(false);

    servicioFalso.registrarVendedor.mockReturnValue(of({ ...respuestaLoginOk, rol: 'VENDEDOR' }));
    component.form.patchValue({
      nombreComercial: 'Tienda Ana',
      cifNif: 'B12345678',
      categoriaPrincipalId: 'categoria-1',
    });

    component.enviar();
    await fixture.whenStable();

    expect(servicioFalso.registrarVendedor).toHaveBeenCalledWith({
      nombre: 'Ana',
      apellidos: 'López',
      email: 'ana@example.es',
      contrasena: 'Clave123!',
      confirmarContrasena: 'Clave123!',
      telefono: '',
      imagenPerfil: expect.stringMatching(/^\/assets\/avatares\/vendedor-\d{2}\.svg$/),
      nombreComercial: 'Tienda Ana',
      cifNif: 'B12345678',
      categoriaPrincipalId: 'categoria-1',
    });
    expect(AVATARES_VENDEDOR.map((avatar) => avatar.ruta)).toContain(
      servicioFalso.registrarVendedor.mock.calls[0][0].imagenPerfil,
    );
    expect(routerFalso.navigate).toHaveBeenCalledWith(['/products']);
  });

  it('no intenta registrar otra vez tras crear la cuenta', async () => {
    await configurar('cliente');
    servicioFalso.registrarCliente.mockReturnValue(of(respuestaLoginOk));
    component.form.patchValue({
      nombre: 'Ana',
      apellidos: 'López',
      email: 'ana@example.es',
      contrasena: 'Clave123!',
      confirmarContrasena: 'Clave123!',
      dni: '12345678A',
      fechaNacimiento: '2000-01-01',
    });

    component.enviar();
    await fixture.whenStable();

    expect(component.cuentaCreada()).toBe(true);
    expect(component.puedeReintentarLogin()).toBe(false);
    expect(component.mensajeExito()).toContain('inicio de sesión completado');
    expect(servicioFalso.registrarCliente).toHaveBeenCalledTimes(1);

    component.reintentarInicioSesion();

    expect(servicioFalso.registrarCliente).toHaveBeenCalledTimes(1);
    expect(autenticacionFalsa.login).toHaveBeenCalledTimes(1);
  });

  it('informa si el login del vendedor requiere MFA, sin considerarlo sesión iniciada', async () => {
    await configurar('vendedor');
    servicioFalso.registrarVendedor.mockReturnValue(
      of({
        ...respuestaLoginOk,
        rol: 'VENDEDOR',
        mfaStatus: 'REQUIRES_MFA_SETUP',
        mfaSetupToken: 'setup-token',
      }),
    );
    component.form.patchValue({
      nombre: 'Ana',
      apellidos: 'López',
      email: 'ana@example.es',
      contrasena: 'Clave123!',
      confirmarContrasena: 'Clave123!',
      nombreComercial: 'Tienda Ana',
      cifNif: 'B12345678',
      categoriaPrincipalId: 'categoria-1',
    });

    component.enviar();
    await fixture.whenStable();

    expect(routerFalso.navigate).toHaveBeenCalled();
    expect(component.puedeReintentarLogin()).toBe(false);
  });

  it('muestra un mensaje específico si el correo ya está registrado', async () => {
    await configurar('cliente');
    servicioFalso.registrarCliente.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { error: 'CONFLICT', message: 'El email ya está registrado' },
          }),
      ),
    );
    component.form.patchValue({
      nombre: 'Ana',
      apellidos: 'López',
      email: 'ana@example.es',
      contrasena: 'Clave123!',
      confirmarContrasena: 'Clave123!',
      dni: '12345678A',
      fechaNacimiento: '2000-01-01',
    });

    component.enviar();

    expect(component.mensajeError()).toBe('El email ya está registrado');
  });

  it('muestra el mensaje del servidor si el nombre comercial ya está en uso', async () => {
    await configurar('vendedor');
    servicioFalso.registrarVendedor.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { error: 'CONFLICT', message: 'El nombre comercial ya está en uso' },
          }),
      ),
    );
    component.form.patchValue({
      nombre: 'Ana',
      apellidos: 'López',
      email: 'ana@example.es',
      contrasena: 'Clave123!',
      confirmarContrasena: 'Clave123!',
      nombreComercial: 'Tienda existente',
      cifNif: 'B12345678',
      categoriaPrincipalId: 'categoria-1',
    });

    component.enviar();

    expect(component.mensajeError()).toBe('El nombre comercial ya está en uso');
  });
});
