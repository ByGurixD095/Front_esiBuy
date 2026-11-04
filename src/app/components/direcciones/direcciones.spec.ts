import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { DireccionesService, DireccionGuardada } from '../../services/direcciones.service';
import { DireccionesComponent } from './direcciones';

describe('DireccionesComponent', () => {
  let fixture: ComponentFixture<DireccionesComponent>;
  const service = { listar: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), eliminar: vi.fn() };
  const auth = { errorMessage: (_error: unknown, fallback: string) => fallback };

  async function crear(direcciones: DireccionGuardada[] = []): Promise<void> {
    service.listar.mockReturnValue(of(direcciones));
    await TestBed.configureTestingModule({
      imports: [DireccionesComponent],
      providers: [
        provideRouter([]),
        { provide: DireccionesService, useValue: service },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DireccionesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const html = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    service.listar.mockReset();
    service.crear.mockReset();
    service.actualizar.mockReset();
    service.eliminar.mockReset();
  });

  it('muestra la lista de direcciones guardadas', async () => {
    await crear([
      {
        id: 'address-1',
        nombreCompleto: 'Ana García',
        direccion: 'Calle Mayor 1',
        ciudad: 'Madrid',
        provincia: 'Madrid',
        codigoPostal: '28001',
        pais: 'España',
        telefono: '+34600000000',
      },
    ]);

    expect(html().textContent).toContain('Ana García');
    expect(html().textContent).toContain('Calle Mayor 1');
  });

  it('no envía direcciones incompletas', async () => {
    await crear();
    fixture.componentInstance.guardar();

    expect(service.crear).not.toHaveBeenCalled();
  });
});
