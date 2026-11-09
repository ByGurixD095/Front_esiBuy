import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { ProductInfo } from '../../models/producto.model';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { CarritoService } from '../../services/carrito.service';
import { ListaDeseosService } from '../../services/lista-deseos-service/lista-deseos';
import { ProductoDetalle } from './producto-detalle';

const detalleProducto: ProductInfo = {
  nombre: 'Camiseta ESI',
  numStock: 3,
  precioCent: 2000,
  descripcion: 'Camiseta oficial de la escuela.',
  categoria: 'Ropa',
  urlImagen: null,
  descuento: 10,
  descuentoPremium: 5,
  vendedor: 'Tienda ESI',
};

describe('ProductoDetalle', () => {
  const productoServiceFalso = { obtenerInfo: vi.fn() };
  const carritoFalso = { anadirProducto: vi.fn(), obtenerCarrito: vi.fn() };
  const listasDeseosFalso = { listar: vi.fn(), crear: vi.fn(), agregarProducto: vi.fn() };
  const authFalso = { hasRole: vi.fn() };
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    paramMap = new BehaviorSubject(convertToParamMap({ id: 'producto-1' }));
    productoServiceFalso.obtenerInfo.mockReset().mockReturnValue(of(detalleProducto));
    carritoFalso.anadirProducto.mockReset();
    carritoFalso.obtenerCarrito.mockReset().mockReturnValue(of([]));
    listasDeseosFalso.listar.mockReset().mockReturnValue(of([
      { id: 'lista-1', idCliente: 'cliente-1', nombre: 'Para comprar', productosIds: [] },
    ]));
    listasDeseosFalso.crear.mockReset();
    listasDeseosFalso.agregarProducto.mockReset();
    authFalso.hasRole.mockReset().mockReturnValue(false);
  });

  it('muestra la información y permite comprar a un cliente si hay stock', async () => {
    authFalso.hasRole.mockReturnValue(true);
    await TestBed.configureTestingModule({
      imports: [ProductoDetalle],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap } },
        { provide: ProductService, useValue: productoServiceFalso },
        { provide: CarritoService, useValue: carritoFalso },
        { provide: ListaDeseosService, useValue: listasDeseosFalso },
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProductoDetalle);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(productoServiceFalso.obtenerInfo).toHaveBeenCalledWith('producto-1');
    expect(html.querySelector('h1')?.textContent).toContain('Camiseta ESI');
    expect(html.textContent).toContain('Tienda ESI');
    expect(html.textContent).toContain('18,00');
    expect(html.textContent).toContain('¡Quedan pocas unidades!');
    expect(html.textContent).toContain('Aún no hay valoraciones para este producto.');
    expect(html.querySelector<HTMLButtonElement>('.checkout-button')?.disabled).toBe(false);
  });

  it('vuelve a consultar la información cuando cambia el producto de la ruta', async () => {
    await TestBed.configureTestingModule({
      imports: [ProductoDetalle],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap } },
        { provide: ProductService, useValue: productoServiceFalso },
        { provide: CarritoService, useValue: carritoFalso },
        { provide: ListaDeseosService, useValue: listasDeseosFalso },
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProductoDetalle);
    fixture.detectChanges();

    paramMap.next(convertToParamMap({ id: 'producto-2' }));
    fixture.detectChanges();

    expect(productoServiceFalso.obtenerInfo).toHaveBeenNthCalledWith(2, 'producto-2');
  });

  it('permite al cliente añadir el producto a la cesta desde el detalle', async () => {
    authFalso.hasRole.mockImplementation((roles: string[]) => roles.includes('CLIENTE'));
    carritoFalso.anadirProducto.mockReturnValue(of(undefined));
    carritoFalso.obtenerCarrito.mockReturnValue(of([
      { productoId: 'otro', nombre: 'Otro', precioCent: 100, urlImagen: null, cantidad: 2 },
    ]));
    await TestBed.configureTestingModule({
      imports: [ProductoDetalle],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap } },
        { provide: ProductService, useValue: productoServiceFalso },
        { provide: CarritoService, useValue: carritoFalso },
        { provide: ListaDeseosService, useValue: listasDeseosFalso },
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProductoDetalle);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    html.querySelector<HTMLButtonElement>('.buy-button:not(.checkout-button)')?.click();
    fixture.detectChanges();

    expect(carritoFalso.anadirProducto).toHaveBeenCalledWith('producto-1');
    expect(html.textContent).toContain('Camiseta ESI se ha añadido a tu cesta.');
    expect(html.querySelector('.cart-link[href="/cart"]')?.textContent).toContain('3');
    expect(html.querySelector('.cart-link')?.getAttribute('aria-label')).toContain('3 productos');
  });

  it('permite crear una lista desde el detalle y guarda el producto con confirmación', async () => {
    authFalso.hasRole.mockImplementation((roles: string[]) => roles.includes('CLIENTE'));
    const listaCreada = {
      id: 'lista-nueva',
      idCliente: 'cliente-1',
      nombre: 'Favoritos de ropa',
      productosIds: [],
    };
    listasDeseosFalso.listar.mockReturnValue(of([]));
    listasDeseosFalso.crear.mockReturnValue(of(listaCreada));
    listasDeseosFalso.agregarProducto.mockReturnValue(
      of({ ...listaCreada, productosIds: ['producto-1'] }),
    );
    await TestBed.configureTestingModule({
      imports: [ProductoDetalle],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap } },
        { provide: ProductService, useValue: productoServiceFalso },
        { provide: CarritoService, useValue: carritoFalso },
        { provide: ListaDeseosService, useValue: listasDeseosFalso },
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProductoDetalle);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('.wishlist-button')?.textContent).toContain('Guardar en lista de deseos');
    html.querySelector<HTMLButtonElement>('.wishlist-button')!.click();
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('.wishlist-create-toggle')!.click();
    fixture.detectChanges();
    const input = html.querySelector<HTMLInputElement>('#detail-wishlist-new-name')!;
    input.value = 'Favoritos de ropa';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('.wishlist-create-form .wishlist-action')!.click();
    fixture.detectChanges();

    expect(listasDeseosFalso.crear).toHaveBeenCalledWith('Favoritos de ropa');
    expect(listasDeseosFalso.agregarProducto).toHaveBeenCalledWith('lista-nueva', 'producto-1');
    expect(html.querySelector('[role="dialog"]')).toBeNull();
    expect(html.querySelector('[role="status"]')?.textContent).toContain(
      'Camiseta ESI se ha guardado correctamente en la lista «Favoritos de ropa».',
    );
  });

  it('indica en el detalle si el producto ya estaba en la lista seleccionada', async () => {
    authFalso.hasRole.mockImplementation((roles: string[]) => roles.includes('CLIENTE'));
    const listaConProducto = {
      id: 'lista-1',
      idCliente: 'cliente-1',
      nombre: 'Para comprar',
      productosIds: ['producto-1'],
    };
    listasDeseosFalso.listar.mockReturnValue(of([listaConProducto]));
    listasDeseosFalso.agregarProducto.mockReturnValue(of(listaConProducto));
    await TestBed.configureTestingModule({
      imports: [ProductoDetalle],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap } },
        { provide: ProductService, useValue: productoServiceFalso },
        { provide: CarritoService, useValue: carritoFalso },
        { provide: ListaDeseosService, useValue: listasDeseosFalso },
        { provide: AuthService, useValue: authFalso },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProductoDetalle);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    html.querySelector<HTMLButtonElement>('.wishlist-button')!.click();
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('.wishlist-dialog-actions .wishlist-action')!.click();
    fixture.detectChanges();

    expect(html.querySelector('.cart-feedback[role="status"]')?.textContent).toContain(
      'Camiseta ESI ya está añadido a la lista de deseos «Para comprar».',
    );
  });
});
