import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InicioSesion } from './inicio-sesion';

describe('InicioSesion', () => {
  let component: InicioSesion;
  let fixture: ComponentFixture<InicioSesion>;
  let el: HTMLElement;

  const rellenar = (usuario: string, contrasena: string) =>
    component.form.setValue({ usuario, contrasena });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InicioSesion],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(InicioSesion);
    component = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra el campo de usuario y el de contraseña', () => {
    expect(el.querySelector('input[formControlName="usuario"]')).not.toBeNull();
    const contrasena = el.querySelector('input[formControlName="contrasena"]') as HTMLInputElement;
    expect(contrasena).not.toBeNull();
    expect(contrasena.type).toBe('password');
  });

  it('el formulario vacío es inválido', () => {
    expect(component.form.valid).toBe(false);
  });

  it('es inválido si falta el usuario o la contraseña', () => {
    rellenar('ana@esi.es', '');
    expect(component.form.valid).toBe(false);
    rellenar('', 'Clave#2026x');
    expect(component.form.valid).toBe(false);
  });

  it('es válido con usuario y contraseña', () => {
    rellenar('ana@esi.es', 'Clave#2026x');
    expect(component.form.valid).toBe(true);
  });

  it('el botón de entrar está deshabilitado mientras falten datos', () => {
    const boton = el.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });

  it('al enviar emite las credenciales con el formato que espera el back', () => {
    const emitidas: { username: string; password: string }[] = [];
    component.iniciarSesion.subscribe((credenciales) => emitidas.push(credenciales));
    rellenar('ana@esi.es', 'Clave#2026x');

    component.enviar();

    expect(emitidas).toEqual([{ username: 'ana@esi.es', password: 'Clave#2026x' }]);
  });

  it('no emite nada si el formulario es inválido', () => {
    const emitidas: unknown[] = [];
    component.iniciarSesion.subscribe((credenciales) => emitidas.push(credenciales));

    component.enviar();

    expect(emitidas).toEqual([]);
  });

  it('el botón Mostrar/Ocultar alterna la visibilidad de la contraseña', async () => {
    const campo = el.querySelector('input[formControlName="contrasena"]') as HTMLInputElement;
    const alternar = el.querySelector('button[type="button"]') as HTMLButtonElement;

    alternar.click();
    await fixture.whenStable();
    expect(campo.type).toBe('text');

    alternar.click();
    await fixture.whenStable();
    expect(campo.type).toBe('password');
  });
});
