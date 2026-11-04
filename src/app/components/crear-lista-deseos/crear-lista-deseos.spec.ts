import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import {
  ListaDeseosApiError,
  ListaDeseosService,
} from '../../services/lista-deseos-service/lista-deseos';
import { CrearListaDeseos } from './crear-lista-deseos';

describe('CrearListaDeseos', () => {
  let fixture: ComponentFixture<CrearListaDeseos>;
  const servicioFalso = { crear: vi.fn() };

  async function crear(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CrearListaDeseos],
      providers: [provideRouter([]), { provide: ListaDeseosService, useValue: servicioFalso }],
    }).compileComponents();
    fixture = TestBed.createComponent(CrearListaDeseos);
    fixture.detectChanges();
  }

  const html = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => servicioFalso.crear.mockReset());

  it('envía el nombre y confirma la creación', async () => {
    servicioFalso.crear.mockReturnValue(
      of({ id: 'lista-1', idCliente: 'cliente-1', nombre: 'Para comprar', productosIds: [] }),
    );
    await crear();

    fixture.componentInstance.form.controls.nombre.setValue('  Para comprar  ');
    fixture.componentInstance.crear();
    fixture.detectChanges();

    expect(servicioFalso.crear).toHaveBeenCalledWith('Para comprar');
    expect(html().textContent).toContain('Se ha creado la lista «Para comprar».');
    expect(html().querySelector('.volver-listas')?.getAttribute('href')).toBe('/listas-deseos');
    expect(html().textContent).toContain('Volver a todas las listas');
  });

  it('no envía un nombre en blanco', async () => {
    await crear();

    fixture.componentInstance.form.controls.nombre.setValue('   ');
    fixture.componentInstance.crear();

    expect(servicioFalso.crear).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.nombre.touched).toBe(true);
  });

  it('muestra el error devuelto por el API', async () => {
    servicioFalso.crear.mockReturnValue(
      throwError(() => new ListaDeseosApiError(0, 'Error al crear la lista.')),
    );
    await crear();

    fixture.componentInstance.form.controls.nombre.setValue('Para comprar');
    fixture.componentInstance.crear();
    fixture.detectChanges();

    expect(html().querySelector('[role="alert"]')?.textContent).toContain(
      'Error al crear la lista.',
    );
  });
});
