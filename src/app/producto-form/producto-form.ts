import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Producto, ProductoDTO } from '../models/producto.model';
import { ProductoService } from '../services/producto.service';

@Component({
  selector: 'app-producto-form',
  imports: [ReactiveFormsModule],
  templateUrl: './producto-form.html',
  styleUrl: './producto-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductoForm {
  private readonly formBuilder = inject(FormBuilder);
  private readonly productoService = inject(ProductoService);

  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly createdProduct = signal<Producto | null>(null);

  readonly productoForm = this.formBuilder.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    referencia: ['', [Validators.required, Validators.maxLength(50)]],
    numStock: [0, [Validators.required, Validators.min(0)]],
    precioEuros: [0, [Validators.required, Validators.min(0)]],
    descripcion: ['', [Validators.required, Validators.maxLength(500)]],
    categoria: ['', [Validators.required, Validators.maxLength(50)]],
    urlImagen: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
  });

  enviarFormulario(): void {
    this.submitError.set(null);
    this.createdProduct.set(null);

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
      descripcion: formValue.descripcion.trim(),
      categoria: formValue.categoria.trim(),
      urlImagen: formValue.urlImagen.trim(),
    };

    this.isSubmitting.set(true);
    this.productoService.crearProducto(producto).subscribe({
      next: (createdProduct) => {
        this.createdProduct.set(createdProduct);
        this.productoForm.reset({
          nombre: '',
          referencia: '',
          numStock: 0,
          precioEuros: 0,
          descripcion: '',
          categoria: '',
          urlImagen: '',
        });
        this.isSubmitting.set(false);
      },
      error: (error: Error) => {
        this.submitError.set(error.message);
        this.isSubmitting.set(false);
      },
    });
  }
}
