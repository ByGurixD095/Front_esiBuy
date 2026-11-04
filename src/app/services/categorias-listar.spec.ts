import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { Categorias } from './categorias.service';

describe('Categorias (listar)', () => {
  let servicio: Categorias;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(Categorias);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía un GET público a /categorias', () => {
    servicio.listar().subscribe();

    const peticion = http.expectOne(`${environment.apiUrl}/categorias`);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush([]);
  });

  it('devuelve las categorías que responde el backend', () => {
    const respuesta = [
      { id: 'c1', nombre: 'Hogar' },
      { id: 'c2', nombre: 'Ropa' },
    ];
    let recibido: unknown;

    servicio.listar().subscribe((categorias) => (recibido = categorias));

    http.expectOne(`${environment.apiUrl}/categorias`).flush(respuesta);
    expect(recibido).toEqual(respuesta);
  });
});
