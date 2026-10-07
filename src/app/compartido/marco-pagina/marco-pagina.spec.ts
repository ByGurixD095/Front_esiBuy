import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarcoPagina } from './marco-pagina';

describe('MarcoPagina', () => {
  let fixture: ComponentFixture<MarcoPagina>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarcoPagina],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MarcoPagina);
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra el logo como enlace accesible al inicio', () => {
    const logo = el.querySelector('a.logo') as HTMLAnchorElement;
    expect(logo.getAttribute('aria-label')).toBe('EsiBuy, ir al inicio');
  });

  it('muestra el pie con el copyright del equipo', () => {
    expect(el.querySelector('footer')?.textContent).toContain('© 2026 EsiBuy · Equipo 5');
  });

  it('no muestra la etiqueta de panel ni el enlace de volver por defecto', () => {
    expect(el.querySelector('.panel')).toBeNull();
    expect(el.querySelector('.volver')).toBeNull();
  });

  it('muestra la etiqueta de panel cuando se indica', async () => {
    fixture.componentRef.setInput('panel', 'Panel de administración');
    await fixture.whenStable();
    expect(el.querySelector('.panel')?.textContent).toContain('Panel de administración');
  });

  it('muestra el enlace de volver a la tienda cuando se pide', async () => {
    fixture.componentRef.setInput('volver', true);
    await fixture.whenStable();
    expect(el.querySelector('.volver')?.textContent).toContain('Volver a la tienda');
  });
});
