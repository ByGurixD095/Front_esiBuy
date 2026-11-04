import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PedidosService } from './pedidos.service';

describe('PedidosService', () => {
  let service: PedidosService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PedidosService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PedidosService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('consulta pedidos activos e históricos del cliente', () => {
    service.listarActivos().subscribe();
    const active = httpTesting.expectOne('http://localhost:8080/pedidos/activos');
    expect(active.request.method).toBe('GET');
    expect(active.request.withCredentials).toBe(true);
    active.flush([]);

    service.listarHistorico().subscribe();
    const history = httpTesting.expectOne('http://localhost:8080/pedidos/historico');
    expect(history.request.method).toBe('GET');
    history.flush([]);
  });

  it('usa la cola de vendedor y el filtro de histórico', () => {
    service.listarVendedor(true).subscribe();
    const request = httpTesting.expectOne(
      (candidate) =>
        candidate.url === 'http://localhost:8080/pedidos/vendedor' &&
        candidate.params.get('historico') === 'true',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('confirma pago con la segunda llamada sin datos de tarjeta', () => {
    service.pagar('pedido 1').subscribe();
    const request = httpTesting.expectOne('http://localhost:8080/pedidos/pedido%201/pagar');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.withCredentials).toBe(true);
    request.flush({ id: 'pedido 1', totalCent: 100, estado: 'PAGADO' });
  });
});
