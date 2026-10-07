import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Administradores } from './administradores';

describe('Administradores', () => {
  let servicio: Administradores;
  let http: HttpTestingController;

  const datos = {
    nombre: 'Ana',
    apellidos: 'López García',
    email: 'ana.lopez@esi.es',
    contrasena: 'Admin123!x',
    sede: 'Ciudad Real',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(Administradores);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía un POST a /users/administradores con los datos y las cookies', () => {
    servicio.crear(datos).subscribe();

    const peticion = http.expectOne('http://localhost:8080/users/administradores');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(datos);
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush({});
  });

  it('devuelve el administrador creado que responde el back', () => {
    const respuesta = {
      id: '1',
      nombre: 'Ana',
      apellidos: 'López García',
      email: 'ana.lopez@esi.es',
      sede: 'Ciudad Real',
      rol: 'ADMINISTRADOR',
      mensaje: 'Administrador creado correctamente',
    };
    let recibido: unknown;
    servicio.crear(datos).subscribe((r) => (recibido = r));

    http.expectOne('http://localhost:8080/users/administradores').flush(respuesta);
    expect(recibido).toEqual(respuesta);
  });
});