import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PaginaProducto, Producto } from '../../models/producto.model';
import { AuthService } from '../../services/auth.service';
import { Categorias } from '../../services/categorias.service';
import { Favoritos, FavoritosApiError } from '../../services/favoritos-service/favoritos';
import { CarritoService } from '../../services/carrito.service';
import { ListaDeseos, ListaDeseosApiError, ListaDeseosService } from '../../services/lista-deseos-service/lista-deseos';
import { ProductService } from '../../services/product.service';
import { Catalogo } from './catalogo';

function producto(id: string, nombre: string): Producto {
  return {
    id,
    nombre,
    referencia: `REF-${id}`,
    numStock: 5,
    precioCent: 10000,
    descripcion: null,
    categoriaId: 'c-hogar',
    categoria: 'HOGAR',
    urlImagen: null,
    descuento: 0,
    descuentoPremium: 0,
    activo: true,
  };
}

const pagina: PaginaProducto = {
  content: [producto('p1', 'Lámpara'), producto('p2', 'Mesa')],
  totalElements: 2,
  totalPages: 1,
  number: 0,
};

describe('Catalogo (favoritos HU 15)', () => {
  let fixture: ComponentFixture<Catalogo>;
  const productServiceFalso = { obtenerDisponibles: vi.fn() };
  const favoritosFalso = { listar: vi.fn(), marcar: vi.fn(), quitar: vi.fn() };
  const carritoFalso = { anadirProducto: vi.fn(), obtenerCarrito: vi.fn() };
  const listasDeseosFalso = { listar: vi.fn(), crear: vi.fn(), agregarProducto: vi.fn() };
  const categoriasFalso = { listar: vi.fn() };
  const authFalso = { isAuthenticated: vi.fn(), hasRole: vi.fn() };

  async function crear(rol: 'CLIENTE' | 'VENDEDOR' | null): Promise<void> {
    authFalso.isAuthenticated.mockReturnValue(rol !== null);
    authFalso.hasRole.mockImplementation((roles: string[]) => rol !== null && roles.includes(rol));

    await TestBed.configureTestingModule({
      imports: [Catalogo],
      providers: [
        provideRouter([]),
        { provide: ProductService, useValue: productServiceFalso },
        { provide: Favoritos, useValue: favoritosFalso },
        { provide: CarritoService, useValue: carritoFalso },
        { provide: ListaDeseosService, useValue: listasDeseosFalso },
        { provide: Categorias, useValue: categoriasFalso },
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Catalogo);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const html = () => fixture.nativeElement as HTMLElement;
  const corazones = () => html().querySelectorAll<HTMLButtonElement>('.favorite-button');

  beforeEach(() => {
    productServiceFalso.obtenerDisponibles.mockReset();
    productServiceFalso.obtenerDisponibles.mockReturnValue(of(pagina));
    favoritosFalso.listar.mockReset();
    favoritosFalso.listar.mockReturnValue(of([producto('p1', 'Lámpara')]));
    favoritosFalso.marcar.mockReset();
    favoritosFalso.quitar.mockReset();
    carritoFalso.anadirProducto.mockReset();
    carritoFalso.obtenerCarrito.mockReset().mockReturnValue(of([]));
    listasDeseosFalso.listar.mockReset().mockReturnValue(of([
      { id: 'lista-1', idCliente: 'cliente-1', nombre: 'Para comprar', productosIds: [] },
      { id: 'lista-2', idCliente: 'cliente-1', nombre: 'Regalos', productosIds: [] },
    ]));
    listasDeseosFalso.crear.mockReset();
    listasDeseosFalso.agregarProducto.mockReset();
    categoriasFalso.listar.mockReset();
    categoriasFalso.listar.mockReturnValue(of([
      { id: 'c1', nombre: 'Tecnología' },
      { id: 'c2', nombre: 'Moda' },
      { id: 'c3', nombre: 'Hogar' },
    ]));
  });

  it('no muestra el corazón ni pide favoritos a un visitante', async () => {
    await crear(null);

    expect(corazones().length).toBe(0);
    expect(favoritosFalso.listar).not.toHaveBeenCalled();
  });

  it('permite abrir el detalle desde la imagen o la información del producto', async () => {
    await crear(null);

    expect(html().querySelector('.product-image-link[href="/products/p1"]')).not.toBeNull();
    expect(html().querySelector('.product-info-link[href="/products/p1"]')).not.toBeNull();
  });

  it('muestra en el filtro todas las categorías de la lista pública', async () => {
    await crear(null);

    const opciones = Array.from(html().querySelectorAll('select option')).map((opcion) => opcion.textContent?.trim());
    expect(opciones.slice(0, 4)).toEqual(['Todas', 'Tecnología', 'Moda', 'Hogar']);
    expect(categoriasFalso.listar).toHaveBeenCalledOnce();
  });

  it('no muestra el corazón a un vendedor', async () => {
    await crear('VENDEDOR');

    expect(corazones().length).toBe(0);
    expect(favoritosFalso.listar).not.toHaveBeenCalled();
    expect(html().querySelector('a[href="/favoritos"]')).toBeNull();
    expect(html().querySelector('a[href="/listas-deseos"]')).toBeNull();
  });

  it('muestra el enlace Mis listas a un cliente', async () => {
    await crear('CLIENTE');

    expect(html().querySelector('a[href="/listas-deseos"]')?.textContent).toContain('Mis listas');
  });

  it('a un cliente le muestra Gestionar y marca los productos que ya son favoritos', async () => {
    await crear('CLIENTE');

    expect(html().querySelector('a[href="/manage"]')).not.toBeNull();
    expect(corazones().length).toBe(2);
    expect(corazones()[0].getAttribute('aria-pressed')).toBe('true');
    expect(corazones()[0].classList).toContain('is-favorite');
    expect(corazones()[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('añade el producto a la cesta desde el catálogo', async () => {
    carritoFalso.anadirProducto.mockReturnValue(of(undefined));
    await crear('CLIENTE');

    html().querySelector<HTMLButtonElement>('.add-cart-button')?.click();
    fixture.detectChanges();

    expect(carritoFalso.anadirProducto).toHaveBeenCalledWith('p1');
    expect(html().textContent).toContain('Lámpara se ha añadido a tu cesta.');
    expect(html().querySelector('.cart-link .cart-count')?.textContent?.trim()).toBe('1');
  });

  it('muestra en la cabecera el total de unidades que ya hay en la cesta', async () => {
    carritoFalso.obtenerCarrito.mockReturnValue(of([
      { productoId: 'p1', nombre: 'Lámpara', precioCent: 10000, urlImagen: null, cantidad: 2 },
      { productoId: 'p2', nombre: 'Mesa', precioCent: 10000, urlImagen: null, cantidad: 1 },
    ]));
    await crear('CLIENTE');

    expect(html().querySelector('.cart-link .cart-count')?.textContent?.trim()).toBe('3');
    expect(html().querySelector('.cart-link')?.getAttribute('aria-label')).toBe('Mi cesta, 3 productos');
  });

  it('guarda un producto como favorito al pulsar el corazón vacío', async () => {
    favoritosFalso.marcar.mockReturnValue(of(undefined));
    await crear('CLIENTE');

    corazones()[1].click();
    fixture.detectChanges();

    expect(favoritosFalso.marcar).toHaveBeenCalledWith('p2');
    expect(corazones()[1].getAttribute('aria-pressed')).toBe('true');
  });

  it('quita el favorito al pulsar un corazón ya marcado', async () => {
    favoritosFalso.quitar.mockReturnValue(of(undefined));
    await crear('CLIENTE');

    corazones()[0].click();
    fixture.detectChanges();

    expect(favoritosFalso.quitar).toHaveBeenCalledWith('p1');
    expect(corazones()[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('avisa del error y deja el corazón como estaba si falla guardar', async () => {
    favoritosFalso.marcar.mockReturnValue(
      throwError(() => new FavoritosApiError(404, 'Este producto ya no está disponible.')),
    );
    await crear('CLIENTE');

    corazones()[1].click();
    fixture.detectChanges();

    expect(html().querySelector('.favorite-error[role="alert"]')?.textContent).toContain('ya no está disponible');
    expect(corazones()[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('permite elegir una lista y guarda el producto, actualizando el feedback', async () => {
    const listaActualizada: ListaDeseos = {
      id: 'lista-2',
      idCliente: 'cliente-1',
      nombre: 'Regalos',
      productosIds: ['p2'],
    };
    listasDeseosFalso.agregarProducto.mockReturnValue(of(listaActualizada));
    await crear('CLIENTE');

    html().querySelectorAll<HTMLButtonElement>('.add-wishlist-button')[1].click();
    fixture.detectChanges();

    expect(listasDeseosFalso.listar).toHaveBeenCalledOnce();
    expect(html().querySelector('[role="dialog"]')).not.toBeNull();
    const selector = html().querySelector<HTMLSelectElement>('#wishlist-select');
    expect(selector?.value).toBe('lista-1');
    selector!.value = 'lista-2';
    selector!.dispatchEvent(new Event('change'));
    html().querySelector<HTMLButtonElement>('.wishlist-dialog-actions .wishlist-action')!.click();
    fixture.detectChanges();

    expect(listasDeseosFalso.agregarProducto).toHaveBeenCalledWith('lista-2', 'p2');
    expect(html().querySelector('[role="dialog"]')).toBeNull();
    expect(html().querySelector('.cart-feedback[role="status"]')?.textContent).toContain(
      'Mesa se ha guardado correctamente en la lista «Regalos».',
    );
  });

  it('avisa cuando el producto ya estaba guardado en la lista seleccionada', async () => {
    const listaConProducto: ListaDeseos = {
      id: 'lista-1',
      idCliente: 'cliente-1',
      nombre: 'Para comprar',
      productosIds: ['p1'],
    };
    listasDeseosFalso.listar.mockReturnValue(of([listaConProducto]));
    listasDeseosFalso.agregarProducto.mockReturnValue(of(listaConProducto));
    await crear('CLIENTE');

    html().querySelector<HTMLButtonElement>('.add-wishlist-button')!.click();
    fixture.detectChanges();
    html().querySelector<HTMLButtonElement>('.wishlist-dialog-actions .wishlist-action')!.click();
    fixture.detectChanges();

    expect(html().querySelector('.cart-feedback[role="status"]')?.textContent).toContain(
      'Lámpara ya está añadido a la lista de deseos «Para comprar».',
    );
  });

  it('mantiene el selector abierto y muestra el error si falla el guardado', async () => {
    listasDeseosFalso.agregarProducto.mockReturnValue(
      throwError(() => new ListaDeseosApiError(404, 'No se ha encontrado la lista o el producto.')),
    );
    await crear('CLIENTE');

    html().querySelector<HTMLButtonElement>('.add-wishlist-button')!.click();
    fixture.detectChanges();
    html().querySelector<HTMLButtonElement>('.wishlist-dialog-actions .wishlist-action')!.click();
    fixture.detectChanges();

    expect(html().querySelector('[role="dialog"]')).not.toBeNull();
    expect(html().querySelector('.cart-feedback-error[role="alert"]')?.textContent).toContain(
      'No se ha encontrado la lista o el producto.',
    );
  });

  it('permite crear una lista nueva y guardar ahí el producto desde el catálogo', async () => {
    const listaCreada: ListaDeseos = {
      id: 'lista-nueva',
      idCliente: 'cliente-1',
      nombre: 'Ideas',
      productosIds: [],
    };
    const listaActualizada = { ...listaCreada, productosIds: ['p1'] };
    listasDeseosFalso.listar.mockReturnValue(of([]));
    listasDeseosFalso.crear.mockReturnValue(of(listaCreada));
    listasDeseosFalso.agregarProducto.mockReturnValue(of(listaActualizada));
    await crear('CLIENTE');

    html().querySelector<HTMLButtonElement>('.add-wishlist-button')!.click();
    fixture.detectChanges();
    html().querySelector<HTMLButtonElement>('.wishlist-create-toggle')!.click();
    fixture.detectChanges();
    const input = html().querySelector<HTMLInputElement>('#wishlist-new-name')!;
    input.value = 'Ideas';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    html().querySelector<HTMLButtonElement>('.wishlist-create-form .wishlist-action')!.click();
    fixture.detectChanges();

    expect(listasDeseosFalso.crear).toHaveBeenCalledWith('Ideas');
    expect(listasDeseosFalso.agregarProducto).toHaveBeenCalledWith('lista-nueva', 'p1');
    expect(html().querySelector('[role="dialog"]')).toBeNull();
    expect(html().querySelector('.cart-feedback[role="status"]')?.textContent).toContain(
      'Lámpara se ha guardado correctamente en la lista «Ideas».',
    );
  });
});
