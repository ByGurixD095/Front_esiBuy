import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Inicio } from './inicio';

describe('Inicio Component', () => {
  let component: Inicio;
  let fixture: ComponentFixture<Inicio>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Inicio);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('debe crearse el componente correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe renderizar el titular y el badge de comunidad ESI', () => {
    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('.campus-badge');
    const title = el.querySelector('#hero-title');

    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('Comunidad ESI');
    expect(title).toBeTruthy();
    expect(title?.textContent).toContain('La tecnología que necesitas');
  });

  it('debe renderizar las 6 categorías populares', () => {
    const el = fixture.nativeElement as HTMLElement;
    const cards = el.querySelectorAll('.category-card');
    expect(cards.length).toBe(6);
  });

  it('debe permitir cambiar de pestaña de filtrado en productos destacados', () => {
    expect(component.filtroDestacados()).toBe('todos');
    component.seleccionarFiltro('ofertas');
    expect(component.filtroDestacados()).toBe('ofertas');
    component.seleccionarFiltro('baratos');
    expect(component.filtroDestacados()).toBe('baratos');
  });

  it('debe alternar el acordeón de preguntas frecuentes', () => {
    expect(component.faqAbierta()).toBe(0);
    component.toggleFaq(1);
    expect(component.faqAbierta()).toBe(1);
    component.toggleFaq(1);
    expect(component.faqAbierta()).toBeNull();
  });

  it('debe navegar al catálogo al ejecutar búsqueda', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    component.buscar('ThinkPad');
    expect(navigateSpy).toHaveBeenCalledWith(['/products'], {
      queryParams: { busqueda: 'ThinkPad' },
    });
  });
});
