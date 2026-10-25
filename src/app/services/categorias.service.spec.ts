import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Categorias } from './categorias.service';

describe('Categorias', () => {
  let servicio: Categorias;
  let http: HttpTestingController;

  const datos = { nombre: 'Ropa', activo: true };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(Categorias);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía un POST a /admin/categorias con los datos y las cookies', () => {
    servicio.crear(datos).subscribe();

    const peticion = http.expectOne('http://localhost:8080/admin/categorias');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(datos);
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush({ id: 'categoria-1', ...datos });
  });

  it('devuelve la categoría que responde el backend', () => {
    const respuesta = { id: 'categoria-1', ...datos };
    let recibido: unknown;

    servicio.crear(datos).subscribe((categoria) => (recibido = categoria));

    http.expectOne('http://localhost:8080/admin/categorias').flush(respuesta);
    expect(recibido).toEqual(respuesta);
  });
});
