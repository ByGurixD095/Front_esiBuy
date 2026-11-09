import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MarcoPagina } from '../marco-pagina/marco-pagina';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { Producto } from '../../models/producto.model';

export interface CategoriaDestacada {
  id: string;
  nombre: string;
  descripcion: string;
  badge: string;
  icono: 'laptop' | 'robot' | 'monitor' | 'book' | 'headphones' | 'gadget';
}

export interface Testimonio {
  autor: string;
  rol: string;
  comentario: string;
  iniciales: string;
  valoracion: number;
}

export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, MarcoPagina],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio implements OnInit {
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  readonly auth = inject(AuthService);

  readonly terminoBusqueda = signal('');
  readonly filtroDestacados = signal<'todos' | 'ofertas' | 'baratos'>('todos');
  readonly cargandoProductos = signal(true);
  readonly faqAbierta = signal<number | null>(0);

  // Productos del backend (si están disponibles)
  private readonly productosBackend = signal<Producto[]>([]);

  // Productos de demostración de alta fidelidad con temática de la Escuela Superior de Informática (ESI)
  // Garantizan que la interfaz siempre se muestre completa y atractiva aun si el backend local no está levantado
  private readonly productosCurados: Producto[] = [
    {
      id: 'esi-p1',
      nombre: 'Lenovo ThinkPad T14 Gen 3 (16GB RAM, i7)',
      referencia: 'ESI-TECH-01',
      numStock: 2,
      precioCent: 58000,
      descuento: 15,
      descuentoPremium: 5,
      categoriaId: 'cat-laptops',
      categoria: 'Portátiles',
      activo: true,
      descripcion: 'Perfecto para compilar, Docker y máquinas virtuales. Teclado impecable y batería al 94%.',
      urlImagen: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'esi-p2',
      nombre: 'Kit Arduino Mega 2560 + Sensores y Shields',
      referencia: 'ESI-HW-02',
      numStock: 5,
      precioCent: 3200,
      descuento: 20,
      descuentoPremium: 0,
      categoriaId: 'cat-robotica',
      categoria: 'Robótica & Hardware',
      activo: true,
      descripcion: 'Kit completo empleado en las prácticas de Sistemas Inteligentes y Robótica ESI.',
      urlImagen: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'esi-p3',
      nombre: 'Monitor Dell UltraSharp 27" 4K IPS USB-C',
      referencia: 'ESI-PERIF-03',
      numStock: 1,
      precioCent: 24500,
      descuento: 10,
      descuentoPremium: 5,
      categoriaId: 'cat-perifericos',
      categoria: 'Periféricos',
      activo: true,
      descripcion: 'Ideal para programación dual-window y TFG. Hub USB-C con carga para portátil de hasta 90W.',
      urlImagen: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'esi-p4',
      nombre: 'Estructuras de Datos y Algoritmos (Manual Oficial)',
      referencia: 'ESI-BOOK-04',
      numStock: 4,
      precioCent: 1800,
      descuento: 0,
      descuentoPremium: 10,
      categoriaId: 'cat-libros',
      categoria: 'Libros & Apuntes',
      activo: true,
      descripcion: 'Edición revisada con ejercicios resueltos de exámenes anteriores de la titulación.',
      urlImagen: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'esi-p5',
      nombre: 'Raspberry Pi 4 Model B (8GB) con Caja y Disipador',
      referencia: 'ESI-HW-05',
      numStock: 3,
      precioCent: 6500,
      descuento: 12,
      descuentoPremium: 0,
      categoriaId: 'cat-robotica',
      categoria: 'Robótica & Hardware',
      activo: true,
      descripcion: 'Con tarjeta MicroSD Samsung 64GB y Raspberry Pi OS preinstalado. Como nueva.',
      urlImagen: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'esi-p6',
      nombre: 'Teclado Mecánico Keychron K2 RGB Wireless',
      referencia: 'ESI-PERIF-06',
      numStock: 2,
      precioCent: 7200,
      descuento: 25,
      descuentoPremium: 5,
      categoriaId: 'cat-perifericos',
      categoria: 'Periféricos',
      activo: true,
      descripcion: 'Switches Gateron Brown silenciosos ideales para laboratorios y salas de estudio comunes.',
      urlImagen: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80',
    },
  ];

  readonly categorias: CategoriaDestacada[] = [
    {
      id: 'portatiles',
      nombre: 'Portátiles & Ultrabooks',
      descripcion: 'Equipos potentes y ligeros listos para compilar, diseñar y estudiar.',
      badge: '+45 artículos',
      icono: 'laptop',
    },
    {
      id: 'robotica',
      nombre: 'Robótica & Hardware',
      descripcion: 'Placas Arduino, Raspberry Pi, sensores, componentes y kits de laboratorio.',
      badge: 'Prácticas ESI',
      icono: 'robot',
    },
    {
      id: 'perifericos',
      nombre: 'Monitores & Periféricos',
      descripcion: 'Pantallas ergonómicas, teclados mecánicos, ratones y hubs USB.',
      badge: 'Top ventas',
      icono: 'monitor',
    },
    {
      id: 'libros',
      nombre: 'Libros & Material Académico',
      descripcion: 'Bibliografía recomendada, manuales de asignaturas y calculadoras.',
      badge: 'Esenciales',
      icono: 'book',
    },
    {
      id: 'audio',
      nombre: 'Audio & Videollamadas',
      descripcion: 'Auriculares con cancelación de ruido, micros y cámaras para tus presentaciones.',
      badge: 'Popular',
      icono: 'headphones',
    },
    {
      id: 'gadgets',
      nombre: 'Accesorios & Conectividad',
      descripcion: 'Mochilas antirrobo para portátil, adaptadores, cables y periféricos de red.',
      badge: 'Novedades',
      icono: 'gadget',
    },
  ];

  readonly testimonios: Testimonio[] = [
    {
      autor: 'Alejandro Ramos',
      rol: 'Estudiante de 4º Grado en Ingeniería Informática',
      comentario:
        'Conseguí mi portátil ThinkPad para el TFG a mitad de precio comparado con tienda nueva. El vendedor me lo entregó en mano en la cafetería de la ESI y pudimos probarlo juntos.',
      iniciales: 'AR',
      valoracion: 5,
    },
    {
      autor: 'Laura Domínguez',
      rol: 'Estudiante de 2º Doble Grado',
      comentario:
        'Puse a la venta el kit de robótica y los libros del primer curso en cuanto terminé los exámenes. En menos de 48 horas ya tenía dos compañeros interesados. ¡Súper cómodo y seguro!',
      iniciales: 'LD',
      valoracion: 5,
    },
    {
      autor: 'Prof. David S.',
      rol: 'Docente colaborador en la ESI',
      comentario:
        'Una iniciativa excelente para fomentar la economía circular en nuestra Escuela. Facilita que el material docente y tecnológico de calidad no termine guardado en un cajón.',
      iniciales: 'DS',
      valoracion: 5,
    },
  ];

  readonly faqs: PreguntaFrecuente[] = [
    {
      pregunta: '¿Quién puede comprar y vender en EsiBuy?',
      respuesta:
        'EsiBuy está diseñado especialmente para la comunidad universitaria de la Escuela Superior de Informática (alumnos, profesores y personal), garantizando un entorno de máxima confianza y cercanía.',
    },
    {
      pregunta: '¿Cómo se realizan las entregas?',
      respuesta:
        'La mayoría de las compras se entregan cómodamente en mano en el propio campus (en el hall, cafetería o laboratorios) sin ningún coste de envío. Además, disponemos de soporte para direcciones y mensajería si prefieres recibirlo en tu domicilio.',
    },
    {
      pregunta: '¿Qué medidas de seguridad y protección existen?',
      respuesta:
        'Incorporamos autenticación multifactor (2FA con TOTP y 3FA por código de correo electrónico), sesiones cifradas y perfiles verificados para que operes siempre con total seguridad.',
    },
    {
      pregunta: '¿Tiene algún coste publicar productos?',
      respuesta:
        'No, registrarse como vendedor y publicar tus artículos tecnológicos o apuntes es completamente gratuito para los miembros de la comunidad.',
    },
  ];

  // Productos mostrados según el filtro seleccionado
  readonly productosVisibles = computed(() => {
    const base = this.productosBackend().length > 0 ? this.productosBackend() : this.productosCurados;
    const filtro = this.filtroDestacados();

    if (filtro === 'ofertas') {
      return base.filter((p) => p.descuento > 0);
    }
    if (filtro === 'baratos') {
      return base.filter((p) => p.precioCent <= 5000);
    }
    return base;
  });

  ngOnInit(): void {
    this.cargarProductosDestacados();
  }

  private cargarProductosDestacados(): void {
    this.cargandoProductos.set(true);
    this.productService.obtenerDisponibles({}, 0, 8).subscribe({
      next: (pagina) => {
        if (pagina && pagina.content && pagina.content.length > 0) {
          this.productosBackend.set(pagina.content);
        }
        this.cargandoProductos.set(false);
      },
      error: () => {
        // En caso de que no haya conexión al backend, mantenemos los productos curados
        this.cargandoProductos.set(false);
      },
    });
  }

  buscar(termino: string): void {
    const query = (termino || '').trim();
    if (query) {
      this.router.navigate(['/products'], { queryParams: { busqueda: query } });
    } else {
      this.router.navigate(['/products']);
    }
  }

  filtrarPorTag(tag: string): void {
    this.buscar(tag);
  }

  seleccionarFiltro(tipo: 'todos' | 'ofertas' | 'baratos'): void {
    this.filtroDestacados.set(tipo);
  }

  toggleFaq(index: number): void {
    this.faqAbierta.update((actual) => (actual === index ? null : index));
  }

  formatearPrecio(centimos: number): string {
    return (centimos / 100).toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    });
  }

  formatearPrecioConDescuento(centimos: number, descuento: number): string {
    const finalCent = centimos * (1 - descuento / 100);
    return (finalCent / 100).toLocaleString('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    });
  }
}
