import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdministradorRegistro } from './administrador-registro';
import { Administradores } from '../administradores';

describe('AdministradorRegistro', () => {
  let component: AdministradorRegistro;
  let fixture: ComponentFixture<AdministradorRegistro>;

  const datosValidos = {
    nombre: 'Ana',
    apellidos: 'López García',
    email: 'ana.lopez@esi.es',
    contrasena: 'Admin123!x',
    sede: 'Ciudad Real',
  };

  const respuestaOk = {
    id: '1',
    nombre: 'Ana',
    apellidos: 'López García',
    email: 'ana.lopez@esi.es',
    sede: 'Ciudad Real',
    rol: 'ADMINISTRADOR',
    mensaje: 'Administrador creado correctamente',
  };

  const servicioFalso = { crear: vi.fn() };

  beforeEach(async () => {
    servicioFalso.crear.mockReset();
    await TestBed.configureTestingModule({
      imports: [AdministradorRegistro],
      providers: [provideRouter([]), { provide: Administradores, useValue: servicioFalso }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdministradorRegistro);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('el formulario vacío es inválido', () => {
    expect(component.form.valid).toBe(false);
  });

  it('con datos válidos el formulario es válido', () => {
    component.form.setValue(datosValidos);
    expect(component.form.valid).toBe(true);
  });

  it('la sede es opcional', () => {
    component.form.setValue({ ...datosValidos, sede: '' });
    expect(component.form.valid).toBe(true);
  });

  it('rechaza un email con formato inválido', () => {
    component.form.setValue({ ...datosValidos, email: 'ana.lopez' });
    expect(component.form.controls.email.valid).toBe(false);
  });

  it('rechaza una contraseña demasiado corta', () => {
    component.form.setValue({ ...datosValidos, contrasena: 'Ab1!' });
    expect(component.form.controls.contrasena.valid).toBe(false);
  });

  it('rechaza una contraseña sin mayúscula, número o símbolo', () => {
    for (const debil of ['abcdefgh', 'ABCDEFGH', 'Abcdefgh', 'Abcdefg1', 'abcdefg1!']) {
      component.form.setValue({ ...datosValidos, contrasena: debil });
      expect(component.form.controls.contrasena.valid).toBe(false);
    }
  });

  it('muestra los cinco campos del formulario', () => {
    const el = fixture.nativeElement as HTMLElement;
    for (const campo of ['nombre', 'apellidos', 'email', 'contrasena', 'sede']) {
      expect(el.querySelector(`[formControlName="${campo}"]`)).not.toBeNull();
    }
  });

  it('el botón de enviar está deshabilitado mientras el formulario sea inválido', () => {
    const boton = (fixture.nativeElement as HTMLElement).querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });

  describe('envío al back', () => {
    const el = () => fixture.nativeElement as HTMLElement;

    it('no llama al servicio si el formulario es inválido', () => {
      component.enviar();
      expect(servicioFalso.crear).not.toHaveBeenCalled();
    });

    it('envía los datos al servicio cuando el formulario es válido', () => {
      servicioFalso.crear.mockReturnValue(of(respuestaOk));
      component.form.setValue(datosValidos);

      component.enviar();

      expect(servicioFalso.crear).toHaveBeenCalledWith(datosValidos);
    });

    it('muestra el mensaje de éxito del back y vacía el formulario', async () => {
      servicioFalso.crear.mockReturnValue(of(respuestaOk));
      component.form.setValue(datosValidos);

      component.enviar();
      await fixture.whenStable();

      expect(el().querySelector('.exito')?.textContent).toContain(
        'Administrador creado correctamente',
      );
      expect(component.form.controls.email.value).toBe('');
    });

    it('muestra un error de permisos si el back responde 403', async () => {
      servicioFalso.crear.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 403 })),
      );
      component.form.setValue(datosValidos);

      component.enviar();
      await fixture.whenStable();

      expect(el().querySelector('.error-general')?.textContent).toContain('permisos');
    });

    it('muestra un error genérico si el back responde 400', async () => {
      servicioFalso.crear.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 400 })),
      );
      component.form.setValue(datosValidos);

      component.enviar();
      await fixture.whenStable();

      expect(el().querySelector('.error-general')?.textContent).toContain(
        'No se ha podido crear el administrador',
      );
    });
  });
});