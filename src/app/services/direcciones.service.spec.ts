import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DireccionesService } from './direcciones.service';

describe('DireccionesService', () => {
  let service: DireccionesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DireccionesService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DireccionesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('consulta las direcciones del cliente autenticado', () => {
    service.listar().subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/users/me/direcciones');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush([]);
  });

  it('crea y actualiza una dirección con las rutas autenticadas', () => {
    const direccion = {
      nombreCompleto: 'Ana García',
      direccion: 'Calle Mayor 1',
      ciudad: 'Madrid',
      provincia: 'Madrid',
      codigoPostal: '28001',
      pais: 'España',
      telefono: '+34600000000',
    };

    service.crear(direccion).subscribe();
    const create = httpTesting.expectOne('http://localhost:8080/users/me/direcciones');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(direccion);
    create.flush({ id: 'address-1', ...direccion });

    service.actualizar('address/1', direccion).subscribe();
    const update = httpTesting.expectOne('http://localhost:8080/users/me/direcciones/address%2F1');
    expect(update.request.method).toBe('PUT');
    update.flush({ id: 'address/1', ...direccion });
  });

  it('elimina una dirección mediante DELETE autenticado', () => {
    service.eliminar('address-1').subscribe();

    const request = httpTesting.expectOne('http://localhost:8080/users/me/direcciones/address-1');
    expect(request.request.method).toBe('DELETE');
    expect(request.request.withCredentials).toBe(true);
    request.flush(null);
  });
});
