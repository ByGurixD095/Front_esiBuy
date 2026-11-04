import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Producto, ProductoDTO } from '../../models/producto.model';
import { Categoria, Categorias } from '../../services/categorias.service';
import { ProductoApiError, ProductoService } from '../../services/producto.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { environment } from '../../../environments/environment';

interface BorradorProducto {
  nombre: string;
  referencia: string;
  numStock: number;
  precioEuros: number;
  descuento: number;
  descuentoPremium: number;
  descripcion: string;
  categoriaId: string;
  urlImagen: string;
  activo: boolean;
}

const CLAVE_BORRADOR_PRODUCTO = 'esiBuy.producto.borrador';

@Component({
  selector: 'app-producto-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './producto-form.html',
  styleUrl: './producto-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductoForm implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly productoService = inject(ProductoService);
  private readonly categoriasService = inject(Categorias);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cloudinaryService = inject(CloudinaryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly archivoSeleccionado = signal<File | null>(null);
  readonly imagenPreview = signal<string | null>(null);
  readonly errorImagen = signal('');
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly createdProduct = signal<Producto | null>(null);
  readonly creationSuccess = signal(false);
  readonly draftSaved = signal(false);
  readonly draftRestored = signal(false);
  readonly formSubmitted = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly loadingProduct = signal(false);
  readonly categoriasDisponibles = signal<Categoria[]>([]);
  readonly errorCategorias = signal<string | null>(null);
  private readonly generatedReference = `ESI-${Date.now().toString(36).toUpperCase()}`;

  readonly productoForm = this.formBuilder.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    referencia: [this.generatedReference, [Validators.required, Validators.maxLength(50)]],
    numStock: [1, [Validators.required, Validators.min(0)]],
    precioEuros: [0, [Validators.required, Validators.min(0.01)]],
    descuento: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    descuentoPremium: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    descripcion: ['', [Validators.maxLength(500)]],
    categoriaId: ['', [Validators.required]],
    urlImagen: ['', [Validators.pattern(/^\s*$|^https?:\/\/.+/i)]],
    activo: [true],
  });

  ngOnInit(): void {
    this.categoriasService.listar().subscribe({
      next: (categorias) => this.categoriasDisponibles.set(categorias),
      error: (error: { status: number }) => {
        this.errorCategorias.set(
          error.status === 0
            ? 'No se ha podido conectar con el servidor para cargar las categorías.'
            : `No se han podido cargar las categorías (HTTP ${error.status}).`,
        );
      },
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.restaurarBorrador();
    }

    this.productoForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.draftSaved.set(false);
        this.draftRestored.set(false);
      });

    if (!id) return;

    this.editingId.set(id);
    this.loadingProduct.set(true);
    this.productoService.obtenerProducto(id).subscribe({
      next: (producto) => {
        this.productoForm.patchValue({
          nombre: producto.nombre,
          referencia: producto.referencia,
          numStock: producto.numStock,
          precioEuros: producto.precioCent / 100,
          descuento: producto.descuento,
          descuentoPremium: producto.descuentoPremium,
          descripcion: producto.descripcion ?? '',
          categoriaId: producto.categoriaId,
          urlImagen: producto.urlImagen ?? '',
          activo: producto.activo,
        });
        this.loadingProduct.set(false);
      },
      error: (error: ProductoApiError) => {
        this.submitError.set(error.message);
        this.loadingProduct.set(false);
      },
    });
  }

  guardarBorrador(): void {
    this.submitError.set(null);

    if (!isPlatformBrowser(this.platformId)) {
      this.submitError.set('No se puede guardar el borrador fuera del navegador.');
      return;
    }

    try {
      window.localStorage.setItem(CLAVE_BORRADOR_PRODUCTO, JSON.stringify(this.productoForm.getRawValue()));
      this.draftSaved.set(true);
      this.draftRestored.set(false);
    } catch {
      this.submitError.set('No se pudo guardar el borrador en este navegador. Comprueba que el almacenamiento esté disponible.');
    }
  }

  limitarPrecio(event: Event): void {
    const input = event.target as HTMLInputElement;
    const [euros, decimales] = input.value.replace(',', '.').split('.');
    const valor = decimales === undefined ? euros : `${euros}.${decimales.slice(0, 2)}`;
    input.value = valor;
    this.productoForm.controls.precioEuros.setValue(Number(valor) || 0);
  }

  limitarPorcentaje(event: Event, controlName: 'descuento' | 'descuentoPremium'): void {
    const input = event.target as HTMLInputElement;
    const valor = Math.min(Number(input.value.split('.')[0]) || 0, 100);
    input.value = valor.toString();
    this.productoForm.controls[controlName].setValue(valor);
  }

  private restaurarBorrador(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const borradorGuardado = window.localStorage.getItem(CLAVE_BORRADOR_PRODUCTO);
      if (!borradorGuardado) return;

      const borrador: unknown = JSON.parse(borradorGuardado);
      if (!esBorradorProducto(borrador)) {
        this.submitError.set('El borrador guardado no tiene un formato válido y no se ha podido recuperar.');
        return;
      }

      this.productoForm.patchValue(borrador);
      this.draftSaved.set(true);
      this.draftRestored.set(true);
    } catch {
      this.submitError.set('No se pudo recuperar el borrador de este navegador.');
    }
  }

  private eliminarBorradorGuardado(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      window.localStorage.removeItem(CLAVE_BORRADOR_PRODUCTO);
    } catch {
      this.submitError.set('El producto se publicó, pero no se pudo eliminar el borrador guardado en este navegador.');
    }
  }

subirImagenProducto(event: Event): void {
    const inputArchivo = event.target as HTMLInputElement;
    const archivo = inputArchivo.files?.[0];
    inputArchivo.value = '';

    if (!archivo) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      this.errorImagen.set('Elige una imagen JPG, PNG o WebP.');
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      this.errorImagen.set('La imagen no puede superar los 2 MB.');
      return;
    }

    this.errorImagen.set('');
    this.archivoSeleccionado.set(archivo); // Guardamos el archivo
    this.imagenPreview.set(URL.createObjectURL(archivo)); // Vista previa local
  }

  enviarFormulario(): void {
    this.submitError.set(null);
    this.createdProduct.set(null);
    this.creationSuccess.set(false);
    this.formSubmitted.set(true);

    if (this.productoForm.invalid) {
      this.productoForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const archivo = this.archivoSeleccionado();

    if (archivo) {
      this.cloudinaryService.subirImagen(archivo, environment.carpetaProductos).subscribe({
        next: (url) => this.ejecutarGuardado(url),
        error: () => {
          this.submitError.set('Error al subir la imagen a la nube.');
          this.isSubmitting.set(false);
        }
      });
    } else {
      // Si no hay archivo nuevo, usamos la URL que ya tuviera
      this.ejecutarGuardado(this.productoForm.controls.urlImagen.value);
    }
  }

  private ejecutarGuardado(urlImagenFinal: string): void {
    const formValue = this.productoForm.getRawValue();
    const producto: ProductoDTO = {
      nombre: formValue.nombre.trim(),
      referencia: formValue.referencia.trim(),
      numStock: formValue.numStock,
      precioCent: Math.round(formValue.precioEuros * 100),
      descuento: formValue.descuento ?? 0,
      descuentoPremium: formValue.descuentoPremium ?? 0,
      descripcion: formValue.descripcion.trim() || null,
      categoriaId: formValue.categoriaId.trim(),
      urlImagen: urlImagenFinal.trim() || null, // Usamos la URL final
      activo: formValue.activo,
    };

    const request = this.editingId()
      ? this.productoService.actualizarProducto(this.editingId()!, producto)
      : this.productoService.crearProducto(producto);

    request.subscribe({
      next: (createdProduct) => {
        this.createdProduct.set(createdProduct);
        this.creationSuccess.set(true);
        
        if (this.editingId()) {
          this.isSubmitting.set(false);
          window.setTimeout(() => void this.router.navigate(['/products/catalogo']), 800);
          return;
        }

        this.eliminarBorradorGuardado();
        // Reset manual simplificado
        this.formSubmitted.set(false);
        this.isSubmitting.set(false);
        window.setTimeout(() => {
          void this.router.navigate(['/products'], { queryParams: { published: 'true' } });
        }, 1200);
      },
      error: (error: ProductoApiError | Error) => {
        this.submitError.set(error.message);
        this.isSubmitting.set(false);
      },
    });
  }

}

function esBorradorProducto(valor: unknown): valor is BorradorProducto {
  if (typeof valor !== 'object' || valor === null) return false;

  const borrador = valor as Record<string, unknown>;
  return (
    typeof borrador['nombre'] === 'string' &&
    typeof borrador['referencia'] === 'string' &&
    typeof borrador['numStock'] === 'number' &&
    typeof borrador['precioEuros'] === 'number' &&
    typeof borrador['descuento'] === 'number' &&
    typeof borrador['descuentoPremium'] === 'number' &&
    typeof borrador['descripcion'] === 'string' &&
    typeof borrador['categoriaId'] === 'string' &&
    typeof borrador['urlImagen'] === 'string' &&
    typeof borrador['activo'] === 'boolean'
  );
}
