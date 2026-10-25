import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MarcoPagina } from '../marco-pagina/marco-pagina';
import { Categorias } from '../../services/categorias.service';

const NO_VACIO = /\S/;

@Component({
  selector: 'app-crear-categoria',
  imports: [ReactiveFormsModule, MarcoPagina],
  templateUrl: './crear-categoria.html',
  styleUrl: './crear-categoria.css',
})
export class CrearCategoria {
  private readonly categorias = inject(Categorias);

  readonly mensajeExito = signal('');
  readonly mensajeError = signal('');
  readonly enviando = signal(false);

  readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NO_VACIO)],
    }),
    activo: new FormControl(true, { nonNullable: true }),
  });

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.mensajeExito.set('');
    this.mensajeError.set('');
    this.enviando.set(true);

    this.categorias.crear(this.form.getRawValue()).subscribe({
      next: () => {
        this.enviando.set(false);
        this.mensajeExito.set('Categoría creada correctamente');
        this.form.reset({ nombre: '', activo: true });
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.mensajeError.set(this.textoDeError(error));
      },
    });
  }

  esInvalido(): boolean {
    const control = this.form.controls.nombre;
    return control.invalid && (control.touched || control.dirty);
  }

  private textoDeError(error: HttpErrorResponse): string {
    if (error.status === 401 || error.status === 403) {
      return 'No tienes permisos para crear categorías. Inicia sesión como administrador.';
    }
    if (error.status === 0) {
      return 'No se ha podido conectar con el servidor.';
    }
    const mensaje = error.error?.message ?? error.error?.mensaje ?? error.error?.detail;
    if (typeof mensaje === 'string' && mensaje.trim()) {
      return mensaje;
    }
    if (error.status === 409) {
      return 'Ya existe una categoría con ese nombre.';
    }
    if (error.status === 400) {
      return 'El nombre de la categoría no puede estar vacío.';
    }
    if (error.status === 404) {
      return 'El servidor no tiene disponible el endpoint para crear categorías.';
    }
    return 'No se ha podido crear la categoría. Inténtalo de nuevo.';
  }
}
