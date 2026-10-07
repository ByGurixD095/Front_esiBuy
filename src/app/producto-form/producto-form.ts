import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Producto, ProductoDTO } from '../models/producto.model';
import { ProductoApiError, ProductoService } from '../services/producto.service';

@Component({
  selector: 'app-producto-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './producto-form.html',
  styleUrl: './producto-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductoForm {
  private readonly formBuilder = inject(FormBuilder);
  private readonly productoService = inject(ProductoService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly createdProduct = signal<Producto | null>(null);
  readonly creationSuccess = signal(false);
  readonly draftSaved = signal(false);
  readonly formSubmitted = signal(false);
  private readonly generatedReference = `ESI-${Date.now().toString(36).toUpperCase()}`;

  readonly productoForm = this.formBuilder.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    referencia: [this.generatedReference, [Validators.required, Validators.maxLength(50)]],
    numStock: [1, [Validators.required, Validators.min(0)]],
    precioEuros: [0, [Validators.required, Validators.min(0.01)]],
    descuento: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    descuentoPremium: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    descripcion: ['', [Validators.maxLength(500)]],
    categoria: ['', [Validators.required, Validators.maxLength(50)]],
    urlImagen: ['', [Validators.pattern(/^\s*$|^https?:\/\/.+/i)]],
    activo: [true],
  });

  guardarBorrador(): void {
    this.draftSaved.set(true);
    this.submitError.set(null);
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
    input.value = valor;
    this.productoForm.controls[controlName].setValue(valor);
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

    const formValue = this.productoForm.getRawValue();
    const producto: ProductoDTO = {
      nombre: formValue.nombre.trim(),
      referencia: formValue.referencia.trim(),
      numStock: formValue.numStock,
      precioCent: Math.round(formValue.precioEuros * 100),
      descuento: formValue.descuento ?? 0,
      descuentoPremium: formValue.descuentoPremium ?? 0,
      descripcion: formValue.descripcion.trim() || null,
      categoria: formValue.categoria.trim(),
      urlImagen: formValue.urlImagen.trim() || null,
      activo: formValue.activo,
    };

    this.isSubmitting.set(true);
    this.productoService.crearProducto(producto).subscribe({
      next: (createdProduct) => {
        this.createdProduct.set(createdProduct);
        this.creationSuccess.set(true);
        this.productoForm.reset({
          nombre: '',
          referencia: this.generatedReference,
          numStock: 1,
          precioEuros: 0,
          descuento: 0,
          descuentoPremium: 0,
          descripcion: '',
          categoria: '',
          urlImagen: '',
          activo: true,
        });
        this.formSubmitted.set(false);
        this.isSubmitting.set(false);
        window.setTimeout(() => {
          void this.router.navigate(['/products'], {
            queryParams: { published: 'true' },
          });
        }, 1200);
      },
      error: (error: ProductoApiError | Error) => {
        this.submitError.set(error.message);
        this.isSubmitting.set(false);
      },
    });
  }
}
