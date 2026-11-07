import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ListaDeseosApiError, ListaDeseosService } from './lista-deseos';

describe('ListaDeseosService', () => {
  let servicio: ListaDeseosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ListaDeseosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crea una lista para el cliente con nombre y credenciales', () => {
    const lista = {
      id: 'lista-1',
      idCliente: 'cliente-1',
      nombre: 'Para comprar',
      productosIds: [],
    };
    let resultado: unknown;

    servicio.crear('Para comprar').subscribe((creada) => (resultado = creada));

    const peticion = http.expectOne('http://localhost:8080/listas-deseos');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ nombre: 'Para comprar' });
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(lista, { status: 201, statusText: 'Created' });

    expect(resultado).toEqual(lista);
  });

  it('consulta todas las listas del cliente con sus credenciales', () => {
    const listas = [
      { id: 'lista-1', idCliente: 'cliente-1', nombre: 'Para comprar', productosIds: [] },
      { id: 'lista-2', idCliente: 'cliente-1', nombre: 'Regalos', productosIds: ['producto-1'] },
    ];
    let resultado: unknown;

    servicio.listar().subscribe((respuesta) => (resultado = respuesta));

    const peticion = http.expectOne('http://localhost:8080/listas-deseos');
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(listas);

    expect(resultado).toEqual(listas);
  });

  it('modifica el nombre de una lista con PUT y credenciales', () => {
    const listaActualizada = {
      id: 'lista con espacios',
      idCliente: 'cliente-1',
      nombre: 'Favoritos',
      productosIds: ['producto-1'],
    };
    let resultado: unknown;

    servicio.modificarLista('lista con espacios', 'Favoritos').subscribe((lista) => {
      resultado = lista;
    });

    const peticion = http.expectOne('http://localhost:8080/listas-deseos/lista%20con%20espacios');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({ nombre: 'Favoritos' });
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(listaActualizada);

    expect(resultado).toEqual(listaActualizada);
  });

  it('elimina una lista con DELETE y credenciales', () => {
    servicio.eliminarLista('lista con espacios').subscribe();

    const peticion = http.expectOne('http://localhost:8080/listas-deseos/lista%20con%20espacios');
    expect(peticion.request.method).toBe('DELETE');
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('consulta los productos de una lista codificando el identificador', () => {
    const productos = [{ id: 'producto-1', nombre: 'Teclado' }];
    let resultado: unknown;

    servicio.obtenerProductos('lista con espacios').subscribe((respuesta) => (resultado = respuesta));

    const peticion = http.expectOne(
      'http://localhost:8080/listas-deseos/lista%20con%20espacios/productos',
    );
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(productos);

    expect(resultado).toEqual(productos);
  });

  it('añade un producto a la lista con credenciales y codifica los identificadores', () => {
    const listaActualizada = {
      id: 'lista con espacios',
      idCliente: 'cliente-1',
      nombre: 'Para comprar',
      productosIds: ['producto/1'],
    };
    let resultado: unknown;

    servicio.agregarProducto('lista con espacios', 'producto/1').subscribe((lista) => {
      resultado = lista;
    });

    const peticion = http.expectOne(
      'http://localhost:8080/listas-deseos/lista%20con%20espacios/productos/producto%2F1',
    );
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({});
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(listaActualizada);

    expect(resultado).toEqual(listaActualizada);
  });

  it('traduce errores del guardado en un mensaje comprensible', () => {
    let error: ListaDeseosApiError | undefined;

    servicio.agregarProducto('lista-1', 'producto-1').subscribe({ error: (e) => (error = e) });
    http
      .expectOne('http://localhost:8080/listas-deseos/lista-1/productos/producto-1')
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect(error).toBeInstanceOf(ListaDeseosApiError);
    expect(error?.message).toContain('No se ha encontrado la lista o el producto.');
  });

  it('traduce un 403 a un mensaje de rol no permitido', () => {
    let error: ListaDeseosApiError | undefined;

    servicio.crear('Para comprar').subscribe({ error: (e) => (error = e) });
    http
      .expectOne('http://localhost:8080/listas-deseos')
      .flush(null, { status: 403, statusText: 'Forbidden' });

    expect(error).toBeInstanceOf(ListaDeseosApiError);
    expect(error?.message).toBe('Solo los clientes pueden crear listas de deseos.');
  });
});
