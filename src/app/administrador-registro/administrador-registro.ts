import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Administradores } from '../administradores';
import { MarcoPagina } from '../compartido/marco-pagina/marco-pagina';

// Misma política que AdministradorRegistroDTO del back
const PATRON_CONTRASENA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).+$/;
const NO_VACIO = /\S/;

@Component({
  selector: 'app-administrador-registro',
  imports: [ReactiveFormsModule, MarcoPagina],
  templateUrl: './administrador-registro.html',
  styleUrl: './administrador-registro.css',
})
export class AdministradorRegistro {
  private readonly administradores = inject(Administradores);

  readonly mensajeExito = signal('');
  readonly mensajeError = signal('');
  readonly enviando = signal(false);

  readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NO_VACIO)],
    }),
    apellidos: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NO_VACIO)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    contrasena: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(64),
        Validators.pattern(PATRON_CONTRASENA),
      ],
    }),
    sede: new FormControl('', { nonNullable: true }),
  });

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.mensajeExito.set('');
    this.mensajeError.set('');
    this.enviando.set(true);

    this.administradores.crear(this.form.getRawValue()).subscribe({
      next: (respuesta) => {
        this.enviando.set(false);
        this.mensajeExito.set(respuesta.mensaje);
        this.form.reset();
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.mensajeError.set(this.textoDeError(error));
      },
    });
  }

  private textoDeError(error: HttpErrorResponse): string {
    if (error.status === 401 || error.status === 403) {
      return 'No tienes permisos para crear administradores. Inicia sesión como administrador.';
    }
    if (error.status === 0) {
      return 'No se ha podido conectar con el servidor.';
    }
    return 'No se ha podido crear el administrador. Revisa los datos e inténtalo de nuevo.';
  }

  esInvalido(campo: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }
}