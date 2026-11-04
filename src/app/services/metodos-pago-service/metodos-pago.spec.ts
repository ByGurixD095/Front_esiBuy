import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MetodosPagoService } from './metodos-pago';

describe('MetodosPagoService', () => {
  let servicio: MetodosPagoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(MetodosPagoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta los métodos del cliente actual', () => {
    let resultado: unknown;
    servicio.listar().subscribe((metodos) => (resultado = metodos));

    const peticion = http.expectOne('http://localhost:8080/users/me/metodoPago');
    expect(peticion.request.method).toBe('GET');
    peticion.flush([{ id: 'mp-1', tipo: 'TARJETA', alias: 'Personal', referencia: '**** 1234' }]);

    expect(resultado).toEqual([
      { id: 'mp-1', tipo: 'TARJETA', alias: 'Personal', referencia: '**** 1234' },
    ]);
  });

  it('registra un método con el payload esperado', () => {
    const datos = {
      tipo: 'BIZUM' as const,
      alias: 'Móvil',
      titular: 'Móvil',
      telefonoBizum: '612345678',
    };
    let resultado: unknown;
    servicio.registrar(datos).subscribe((metodo) => (resultado = metodo));

    const peticion = http.expectOne('http://localhost:8080/users/me/metodoPago');
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual(datos);
    peticion.flush({ id: 'mp-2', ...datos });

    expect(resultado).toEqual({ id: 'mp-2', ...datos });
  });

  it('modifica un método de pago por su identificador', () => {
    const datos = {
      tipo: 'TARJETA' as const,
      alias: 'Personal',
      titular: 'Ana Pérez',
      numeroTarjeta: '**** 1234',
      caducidad: '12/2028',
    };
    let resultado: unknown;
    servicio.modificar('mp-1', datos).subscribe((metodo) => (resultado = metodo));

    const peticion = http.expectOne('http://localhost:8080/users/me/metodoPago/mp-1');
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual(datos);
    peticion.flush({ id: 'mp-1', tipo: 'TARJETA', referencia: '**** 1234', ...datos });

    expect(resultado).toEqual({ id: 'mp-1', tipo: 'TARJETA', referencia: '**** 1234', ...datos });
  });

  it('elimina un método de pago por su identificador', () => {
    let completado = false;
    servicio.eliminar('mp-1').subscribe(() => (completado = true));

    const peticion = http.expectOne('http://localhost:8080/users/me/metodoPago/mp-1');
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null);

    expect(completado).toBe(true);
  });
});
