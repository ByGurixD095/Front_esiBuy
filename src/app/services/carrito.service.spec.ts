import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CarritoService, ItemCarrito } from './carrito.service';

describe('CarritoService', () => {
  let service: CarritoService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CarritoService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CarritoService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('consulta el carrito autenticado y devuelve sus artículos', () => {
    const respuesta: ItemCarrito[] = [
      { productoId: 'p1', nombre: 'Mochila', precioCent: 2599, urlImagen: null, cantidad: 2 },
    ];
    let resultado: ItemCarrito[] | undefined;

    service.obtenerCarrito().subscribe((items) => (resultado = items));

    const peticion = httpTesting.expectOne('http://localhost:8080/carrito');
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(respuesta);
    expect(resultado).toEqual(respuesta);
  });

  it('envía la cantidad nueva en una petición PATCH autenticada', () => {
    service.actualizarCantidad('p1', 3).subscribe();

    const peticion = httpTesting.expectOne('http://localhost:8080/carrito/p1');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ cantidad: 3 });
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(null);
  });

  it('elimina productos mediante DELETE autenticado', () => {
    service.eliminarProducto('p1').subscribe();

    const peticion = httpTesting.expectOne('http://localhost:8080/carrito/p1');
    expect(peticion.request.method).toBe('DELETE');
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(null);
  });

  it('vacía toda la cesta mediante DELETE autenticado', () => {
    service.vaciar().subscribe();

    const peticion = httpTesting.expectOne('http://localhost:8080/carrito');
    expect(peticion.request.method).toBe('DELETE');
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(null);
  });

  it('añade productos mediante POST autenticado', () => {
    service.anadirProducto('p1').subscribe();

    const peticion = httpTesting.expectOne('http://localhost:8080/carrito/p1');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(null);
  });
});
