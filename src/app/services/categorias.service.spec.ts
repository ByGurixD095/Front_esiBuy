import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Categorias } from './categorias.service';
import { environment } from '../../environments/environment';

describe('Categorias', () => {
  let servicio: Categorias;
  let http: HttpTestingController;

  const datos = { nombre: 'Ropa' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(Categorias);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía un POST a /admin/categorias con los datos y las cookies', () => {
    servicio.crear({ nombre: '  rOPA   de   HOGAR ' }).subscribe();

    const peticion = http.expectOne(`${environment.apiUrl}/admin/categorias`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ nombre: 'Ropa de hogar' });
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush({ id: 'categoria-1', nombre: 'Ropa de hogar' });
  });

  it('devuelve la categoría que responde el backend', () => {
    const respuesta = { id: 'categoria-1', ...datos };
    let recibido: unknown;

    servicio.crear(datos).subscribe((categoria) => (recibido = categoria));

    http.expectOne(`${environment.apiUrl}/admin/categorias`).flush(respuesta);
    expect(recibido).toEqual(respuesta);
  });

  it('envía un PUT administrativo para cambiar el nombre', () => {
    servicio.actualizar('c1', { nombre: '  hOGAR ACTUALIZADO ' }).subscribe();

    const peticion = http.expectOne(`${environment.apiUrl}/admin/categorias/c1`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({ nombre: 'Hogar actualizado' });
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush({ id: 'c1', nombre: 'Hogar actualizado' });
  });

  it('conserva correctamente las mayúsculas de nombres con tildes y eñe', () => {
    servicio.crear({ nombre: '  ÁRBOL Y   NIÑOS ' }).subscribe();

    const peticion = http.expectOne(`${environment.apiUrl}/admin/categorias`);
    expect(peticion.request.body).toEqual({ nombre: 'Árbol y niños' });
    peticion.flush({ id: 'categoria-1', nombre: 'Árbol y niños' });
  });
});
