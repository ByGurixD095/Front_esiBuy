import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CrearCategoria } from './crear-categoria';
import { Categorias } from '../../services/categorias.service';

describe('CrearCategoria', () => {
  let component: CrearCategoria;
  let fixture: ComponentFixture<CrearCategoria>;

  const servicioFalso = { crear: vi.fn() };

  beforeEach(async () => {
    servicioFalso.crear.mockReset();
    await TestBed.configureTestingModule({
      imports: [CrearCategoria],
      providers: [provideRouter([]), { provide: Categorias, useValue: servicioFalso }],
    }).compileComponents();

    fixture = TestBed.createComponent(CrearCategoria);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('inicia con nombre vacío y categoría activa', () => {
    expect(component.form.controls.nombre.value).toBe('');
    expect(component.form.controls.activo.value).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('muestra el campo de nombre y el selector de estado', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[formControlName="nombre"]')).not.toBeNull();
    expect(el.querySelector('[formControlName="activo"]')).not.toBeNull();
  });

  it('rechaza un nombre vacío o compuesto solo por espacios', () => {
    for (const nombre of ['', '   ', '\t']) {
      component.form.controls.nombre.setValue(nombre);
      expect(component.form.controls.nombre.invalid).toBe(true);
    }
  });

  it('envía el nombre original y el estado seleccionado al servicio', () => {
    servicioFalso.crear.mockReturnValue(of({ id: 'categoria-1', nombre: '  Ropa  ', activo: false }));
    component.form.setValue({ nombre: '  Ropa  ', activo: false });

    component.enviar();

    expect(servicioFalso.crear).toHaveBeenCalledWith({ nombre: '  Ropa  ', activo: false });
  });

  it('muestra éxito y reinicia el formulario al crear', async () => {
    servicioFalso.crear.mockReturnValue(
      of({ id: 'categoria-1', nombre: 'Ropa', activo: true }),
    );
    component.form.setValue({ nombre: 'Ropa', activo: true });

    component.enviar();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent)
      .toContain('Categoría creada correctamente');
    expect(component.form.getRawValue()).toEqual({ nombre: '', activo: true });
  });

  it('muestra un mensaje de conflicto si el nombre ya existe', async () => {
    servicioFalso.crear.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { error: 'CONFLICT', message: 'Ya existe una categoría con ese nombre' },
      })),
    );
    component.form.setValue({ nombre: 'Ropa', activo: true });

    component.enviar();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent)
      .toContain('Ya existe una categoría con ese nombre');
  });

  it('muestra el mensaje de validación devuelto por el backend', async () => {
    servicioFalso.crear.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 400,
        error: { error: 'VALIDATION_ERROR', message: 'El nombre contiene caracteres no válidos' },
      })),
    );
    component.form.setValue({ nombre: 'Ropa', activo: true });

    component.enviar();
    await fixture.whenStable();

    expect(component.mensajeError()).toBe('El nombre contiene caracteres no válidos');
  });

  it('explica si el backend no tiene el endpoint de categorías', async () => {
    servicioFalso.crear.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    component.form.setValue({ nombre: 'Ropa', activo: true });

    component.enviar();
    await fixture.whenStable();

    expect(component.mensajeError()).toContain('endpoint para crear categorías');
  });

  it('no llama al servicio si el formulario es inválido', () => {
    component.enviar();
    expect(servicioFalso.crear).not.toHaveBeenCalled();
  });
});
