import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaginaProducto, Producto, ProductoDTO } from '../../models/producto.model';
import { Categoria, Categorias } from '../../services/categorias.service';
import { PanelFiltrosProductos } from '../panel-filtros-productos/panel-filtros-productos';
import { FiltrosProductos, ProductApiError, ProductService, filtrarProductos } from '../../services/product.service';
import { ProductoApiError, ProductoService } from '../../services/producto.service';
import { concatMap, from, toArray } from 'rxjs';

@Component({
  selector: 'app-catalogo-vendedor',
  imports: [RouterLink, PanelFiltrosProductos],
  templateUrl: './catalogo-vendedor.html',
  styleUrl: './catalogo-vendedor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoVendedor implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly productoService = inject(ProductoService);
  private readonly categoriasService = inject(Categorias);

  readonly productos = signal<Producto[]>([]);
  readonly categoriasDisponibles = signal<Categoria[]>([]);
  readonly errorCategorias = signal<string | null>(null);
  readonly totalElementos = signal(0);
  readonly totalPaginas = signal(0);
  readonly paginaActual = signal(0);
  readonly tamanoPagina = 36;
  readonly cargando = signal(true);
  readonly error = signal<{ status: number; message: string } | null>(null);
  readonly cargandoDemo = signal(false);
  readonly demoResultado = signal<string | null>(null);
  readonly productoEliminando = signal<string | null>(null);
  readonly productoBorrandoFisico = signal<string | null>(null);
  private readonly filtros = signal<FiltrosProductos>({});

  ngOnInit(): void {
    this.cargarCategorias();
    this.cargarCatalogo();
  }

  cargarCategorias(): void {
    this.errorCategorias.set(null);
    this.categoriasService.listar().subscribe({
      next: (categorias) => this.categoriasDisponibles.set(categorias),
      error: (error: HttpErrorResponse) => {
        this.errorCategorias.set(
          error.status === 0
            ? 'No se ha podido conectar con el servidor para cargar las categorías.'
            : `No se han podido cargar las categorías (HTTP ${error.status}).`,
        );
      },
    });
  }

  cargarCatalogo(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.productService.obtenerCatalogoVendedor(this.paginaActual(), this.tamanoPagina, this.filtros()).subscribe({
      next: (paginaProductos: PaginaProducto) => {
        this.productos.set(
          filtrarProductos(paginaProductos.content, this.filtros()).sort((a, b) => Number(b.activo) - Number(a.activo)),
        );
        this.totalElementos.set(paginaProductos.totalElements);
        this.totalPaginas.set(paginaProductos.totalPages);
        this.paginaActual.set(paginaProductos.number);
        this.cargando.set(false);
      },
      error: (error: ProductApiError) => {
        this.error.set({ status: error.status, message: error.message });
        this.cargando.set(false);
      },
    });
  }

  aplicarFiltros(filtros: FiltrosProductos): void {
    this.filtros.set(filtros);
    this.paginaActual.set(0);
    this.cargarCatalogo();
  }

  cargarCatalogoDemo(): void {
    if (this.cargandoDemo()) return;

    const productosDemo: ProductoDTO[] = [];
    for (const producto of this.productosDemo) {
      const categoria = this.categoriasDisponibles().find(
        (opcion) =>
          opcion.id === producto.categoriaId ||
          opcion.nombre.toLocaleLowerCase() === producto.categoriaId.toLocaleLowerCase(),
      );
      if (!categoria) {
        this.demoResultado.set(
          `No existe la categoría «${producto.categoriaId}». Créala como administrador antes de cargar los productos de ejemplo.`,
        );
        return;
      }
      productosDemo.push({ ...producto, categoriaId: categoria.id });
    }

    this.cargandoDemo.set(true);
    this.demoResultado.set(null);

    from(productosDemo).pipe(
      concatMap((producto) => this.productoService.crearProducto(producto)),
      toArray(),
    ).subscribe({
      next: (productosCreados) => {
        this.cargandoDemo.set(false);
        this.demoResultado.set(`Se han creado ${productosCreados.length} productos de ejemplo en tu catálogo.`);
        this.cargarCatalogo();
      },
      error: (error: ProductoApiError) => {
        this.cargandoDemo.set(false);
        this.demoResultado.set(error.message);
        this.cargarCatalogo();
      },
    });
  }

  paginaAnterior(): void {
    if (this.paginaActual() === 0) return;
    this.paginaActual.update((pagina) => pagina - 1);
    this.cargarCatalogo();
  }

  cambiarEstadoProducto(producto: Producto): void {
    if (this.productoEliminando()) return;
    const activar = !producto.activo;
    if (!activar && !window.confirm(`¿Quieres desactivar "${producto.nombre}"?`)) return;

    const { id, ...datos } = producto;
    this.productoEliminando.set(id);
    this.productoService.actualizarProducto(id, { ...datos, activo: activar }).subscribe({
      next: () => {
        this.productoEliminando.set(null);
        this.cargarCatalogo();
      },
      error: (error: ProductoApiError) => {
        this.productoEliminando.set(null);
        this.error.set({ status: error.status, message: error.message });
      },
    });
  }

  borrarDefinitivamente(producto: Producto): void {
    if (this.productoBorrandoFisico()) return;
    
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${producto.nombre}"? Desaparecerá de tu catálogo y de las listas de los clientes. Esta acción es irreversible.`)) return;

    this.productoBorrandoFisico.set(producto.id);
    this.productoService.eliminarProducto(producto.id).subscribe({
      next: () => {
        this.productoBorrandoFisico.set(null);
        this.cargarCatalogo();
      },
      error: (error: ProductoApiError) => {
        this.productoBorrandoFisico.set(null);
        this.error.set({ status: error.status, message: error.message });
      },
    });
  }

  private readonly productosDemo: ProductoDTO[] = [
    {
      nombre: 'Auriculares Nova Pro',
      referencia: 'ESI-DEMO-001',
      numStock: 18,
      precioCent: 8999,
      descripcion: 'Auriculares inalámbricos con cancelación de ruido y estuche de carga.',
      categoriaId: 'Tecnología',
      urlImagen: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85',
      descuento: 10,
      descuentoPremium: 15,
      activo: true,
    },
    {
      nombre: 'Cámara Polaroid Studio',
      referencia: 'ESI-DEMO-002',
      numStock: 9,
      precioCent: 12990,
      descripcion: 'Cámara instantánea compacta para capturar recuerdos con estilo.',
      categoriaId: 'Fotografía',
      urlImagen: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=900&q=85',
      descuento: 5,
      descuentoPremium: 10,
      activo: true,
    },
    {
      nombre: 'Zapatillas Urban Run',
      referencia: 'ESI-DEMO-003',
      numStock: 24,
      precioCent: 7490,
      descripcion: 'Zapatillas ligeras con diseño urbano y suela de alta adherencia.',
      categoriaId: 'Moda',
      urlImagen: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85',
      descuento: 15,
      descuentoPremium: 20,
      activo: true,
    },
    {
      nombre: 'Mochila Atlas',
      referencia: 'ESI-DEMO-004',
      numStock: 31,
      precioCent: 4590,
      descripcion: 'Mochila resistente con compartimento acolchado para portátil.',
      categoriaId: 'Accesorios',
      urlImagen: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=max&w=900&q=85',
      descuento: 0,
      descuentoPremium: 8,
      activo: true,
    },
    {
      nombre: 'Lámpara de sobremesa Aura',
      referencia: 'ESI-DEMO-005',
      numStock: 14,
      precioCent: 3999,
      descripcion: 'Lámpara minimalista con luz cálida para escritorio o mesilla.',
      categoriaId: 'Hogar',
      urlImagen: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85',
      descuento: 12,
      descuentoPremium: 18,
      activo: true,
    },
    {
      nombre: 'Reloj Minimal Steel',
      referencia: 'ESI-DEMO-006',
      numStock: 7,
      precioCent: 10900,
      descripcion: 'Reloj de acero inoxidable con esfera limpia y correa intercambiable.',
      categoriaId: 'Moda',
      urlImagen: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=85',
      descuento: 8,
      descuentoPremium: 12,
      activo: true,
    },
    {
      nombre: 'Cafetera Brew One',
      referencia: 'ESI-DEMO-007',
      numStock: 11,
      precioCent: 6799,
      descripcion: 'Cafetera de diseño para preparar café intenso en pocos minutos.',
      categoriaId: 'Hogar',
      urlImagen: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85',
      descuento: 10,
      descuentoPremium: 15,
      activo: true,
    },
    {
      nombre: 'Sudadera Essential',
      referencia: 'ESI-DEMO-008',
      numStock: 26,
      precioCent: 4290,
      descripcion: 'Sudadera de algodón suave con corte relajado y acabado premium.',
      categoriaId: 'Moda',
      urlImagen: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=900&q=85',
      descuento: 20,
      descuentoPremium: 25,
      activo: true,
    },
    {
      nombre: 'Altavoz portátil Pulse',
      referencia: 'ESI-DEMO-009',
      numStock: 16,
      precioCent: 5499,
      descripcion: 'Altavoz Bluetooth compacto con sonido nítido y batería duradera.',
      categoriaId: 'Tecnología',
      urlImagen: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85',
      descuento: 5,
      descuentoPremium: 10,
      activo: true,
    },
    {
      nombre: 'Set de velas Nordic',
      referencia: 'ESI-DEMO-010',
      numStock: 20,
      precioCent: 2490,
      descripcion: 'Set decorativo de velas aromáticas con fragancias suaves.',
      categoriaId: 'Decoración',
      urlImagen: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=85',
      descuento: 0,
      descuentoPremium: 5,
      activo: true,
    },
    {
      nombre: 'Gafas de sol Riviera',
      referencia: 'ESI-DEMO-011',
      numStock: 13,
      precioCent: 3590,
      descripcion: 'Gafas de sol con protección UV y montura ligera.',
      categoriaId: 'Accesorios',
      urlImagen: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=85',
      descuento: 10,
      descuentoPremium: 15,
      activo: true,
    },
    {
      nombre: 'Botella térmica Terra',
      referencia: 'ESI-DEMO-012',
      numStock: 22,
      precioCent: 2199,
      descripcion: 'Botella reutilizable de acero con aislamiento térmico.',
      categoriaId: 'Lifestyle',
      urlImagen: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85',
      descuento: 7,
      descuentoPremium: 10,
      activo: true,
    },
  ];

  paginaSiguiente(): void {
    if (this.paginaActual() + 1 >= this.totalPaginas()) return;
    this.paginaActual.update((pagina) => pagina + 1);
    this.cargarCatalogo();
  }

  formatearPrecio(precioCent: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(precioCent / 100);
  }
}
