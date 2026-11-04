import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Producto } from '../../models/producto.model';
import { PanelFiltrosProductos } from './panel-filtros-productos';

describe('PanelFiltrosProductos', () => {
  let fixture: ComponentFixture<PanelFiltrosProductos>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelFiltrosProductos],
    }).compileComponents();

    fixture = TestBed.createComponent(PanelFiltrosProductos);
    element = fixture.nativeElement as HTMLElement;
  });

  it('conserva todas las categorías cuando los productos pasan a estar filtrados', async () => {
    fixture.componentRef.setInput('productos', [
      crearProducto('1', 'c1', 'Tecnología'),
      crearProducto('2', 'c2', 'Moda'),
      crearProducto('3', 'c3', 'Hogar'),
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentRef.setInput('productos', [crearProducto('1', 'c1', 'Tecnología')]);
    await fixture.whenStable();
    fixture.detectChanges();

    const opciones = Array.from(
      element.querySelector('select')!.querySelectorAll('option'),
    ).map((opcion) => opcion.textContent?.trim());
    expect(opciones.slice(0, 4)).toEqual(['Todas', 'Tecnología', 'Moda', 'Hogar']);
  });

  it('usa la lista recibida del backend aunque no haya productos de esas categorías', async () => {
    fixture.componentRef.setInput('categoriasDisponibles', [{ id: 'c1', nombre: 'Hogar' }]);
    fixture.componentRef.setInput('productos', [crearProducto('1', 'c2', 'Fotografía')]);
    await fixture.whenStable();
    fixture.detectChanges();

    const opciones = Array.from(
      element.querySelector('select')!.querySelectorAll('option'),
    ).map((opcion) => opcion.textContent?.trim());
    expect(opciones).toEqual(['Todas', 'Hogar']);
  });
});

function crearProducto(id: string, categoriaId: string, categoria: string): Producto {
  return {
    id,
    nombre: `Producto ${id}`,
    referencia: `REF-${id}`,
    numStock: 1,
    precioCent: 1000,
    categoriaId,
    categoria,
    descuento: 0,
    descuentoPremium: 0,
    activo: true,
  };
}
