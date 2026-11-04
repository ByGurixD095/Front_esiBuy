import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProductApiError, ProductService } from './product.service';
import { PaginaProducto, ProductInfo } from '../models/producto.model';

describe('ProductService', () => {
  let service: ProductService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProductService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ProductService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('consulta el catálogo real con credenciales y devuelve la página recibida', () => {
    const respuesta: PaginaProducto = {
      content: [
      {
        id: 'disponible-1',
        nombre: 'Camiseta ESI',
        referencia: 'REF-001',
        numStock: 3,
        precioCent: 1999,
        descripcion: 'Camiseta oficial',
        categoriaId: 'c-ropa',
        categoria: 'Ropa',
        urlImagen: null,
        descuento: 10,
        descuentoPremium: 5,
        activo: true,
      },
      {
        id: 'agotado-1',
        nombre: 'Mochila ESI',
        referencia: 'REF-002',
        numStock: 0,
        precioCent: 2990,
        descripcion: null,
        categoriaId: 'c-papeleria',
        categoria: 'Papelería',
        urlImagen: null,
        descuento: 0,
        descuentoPremium: 0,
        activo: true,
      },
      {
        id: 'inactivo-1',
        nombre: 'Producto retirado',
        referencia: 'REF-003',
        numStock: 4,
        precioCent: 1000,
        descripcion: null,
        categoriaId: 'c-otros',
        categoria: 'Otros',
        urlImagen: null,
        descuento: 0,
        descuentoPremium: 0,
        activo: false,
      },
      ],
      totalElements: 3,
      totalPages: 1,
      number: 0,
    };

    let resultado: PaginaProducto | undefined;
    service.obtenerDisponibles().subscribe((productos) => (resultado = productos));

    const request = httpTesting.expectOne((req) => req.urlWithParams === 'http://localhost:8080/products/disponibles?page=0&size=36');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush(respuesta);

    expect(resultado).toEqual(respuesta);
  });

  it('solicita el catálogo del vendedor ordenado por estado activo descendente', () => {
    service.obtenerCatalogoVendedor(1, 36).subscribe();

    const request = httpTesting.expectOne(
      (req) => req.urlWithParams === 'http://localhost:8080/products/catalogo?page=1&size=36&sort=activo,desc',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 1,
    });
  });

  it('filtra por identificador estable de categoría', () => {
    service.obtenerDisponibles({ categoriaId: 'categoria-1' }).subscribe();

    const request = httpTesting.expectOne(
      (req) => req.urlWithParams === 'http://localhost:8080/products/disponibles?categoriaId=categoria-1&page=0&size=36',
    );
    request.flush({ content: [], totalElements: 0, totalPages: 0, number: 0 });
  });

  it('consulta la información pública del producto con credenciales', () => {
    const respuesta: ProductInfo = {
      nombre: 'Camiseta ESI',
      numStock: 3,
      precioCent: 1999,
      descripcion: 'Camiseta oficial',
      categoria: 'Ropa',
      urlImagen: null,
      descuento: 10,
      descuentoPremium: 5,
      vendedor: 'Tienda ESI',
    };

    let resultado: ProductInfo | undefined;
    service.obtenerInfo('producto/1').subscribe((info) => (resultado = info));

    const request = httpTesting.expectOne('http://localhost:8080/products/producto%2F1/info');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush(respuesta);

    expect(resultado).toEqual(respuesta);
  });

  it('propaga un 403 como ProductApiError sin sustituirlo por datos falsos', () => {
    let errorRecibido: ProductApiError | undefined;
    service.obtenerDisponibles().subscribe({
      error: (error: ProductApiError) => (errorRecibido = error),
    });

    const request = httpTesting.expectOne((req) => req.urlWithParams === 'http://localhost:8080/products/disponibles?page=0&size=36');
    request.flush(null, new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }));

    expect(errorRecibido).toBeInstanceOf(ProductApiError);
    expect(errorRecibido?.status).toBe(403);
    expect(errorRecibido?.message).toContain('no tiene permiso');
  });
});
