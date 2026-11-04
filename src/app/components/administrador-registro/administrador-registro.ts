import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AbstractControl, 
         FormControl, FormGroup, 
         ReactiveFormsModule,
         ValidationErrors, Validators } from '@angular/forms';
import { MarcoPagina } from '../marco-pagina/marco-pagina';
import { Administradores } from '../../services/crear-admin-service/administradores';
import { AvatarSelector, avatarAleatorio } from '../avatar-selector/avatar-selector';
import { CloudinaryService } from '../../services/cloudinary.service';
import { environment } from '../../../environments/environment';

// Misma política que AdministradorRegistroDTO del back
const PATRON_CONTRASENA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).+$/;
const NO_VACIO = /\S/;

function validarDatosPersonales(control: AbstractControl): ValidationErrors | null {
  const form = control.parent;
  if (!form) return null;

  const contrasena = control.value?.toLowerCase() || '';
  if (!contrasena) return null;

  const nombre = form.get('nombre')?.value?.toLowerCase();
  const email = form.get('email')?.value?.toLowerCase();

  // Comprueba que no incluya el nombre (mínimo 3 letras para evitar falsos positivos)
  if (nombre && nombre.length > 2 && contrasena.includes(nombre)) {
    return { contieneNombre: true };
  }
  
  // Comprueba que no incluya la parte local del correo
  if (email) {
    const parteLocal = email.split('@')[0];
    if (parteLocal.length > 2 && contrasena.includes(parteLocal)) {
      return { contieneEmail: true };
    }
  }
  return null;
}

@Component({
  selector: 'app-administrador-registro',
  imports: [ReactiveFormsModule, MarcoPagina, AvatarSelector],
  templateUrl: './administrador-registro.html',
  styleUrl: './administrador-registro.css',
})
export class AdministradorRegistro {
  private readonly administradores = inject(Administradores);
  private readonly cloudinary = inject(CloudinaryService);
  readonly archivoAvatar = signal<File | null>(null);
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
        Validators.maxLength(72),
        Validators.pattern(PATRON_CONTRASENA),
        validarDatosPersonales
      ],
    }),
    confirmarContrasena: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    sede: new FormControl('', { nonNullable: true }),
    imagenPerfil: new FormControl('', { nonNullable: true }),
  });

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    
    this.mensajeExito.set('');
    this.mensajeError.set('');
    this.enviando.set(true);

    const archivo = this.archivoAvatar();
    if (archivo) {
      this.cloudinary.subirImagen(archivo, environment.carpetaAvatares).subscribe({
        next: (url) => this.ejecutarRegistro(url),
        error: () => {
          this.mensajeError.set('Error al subir la imagen de perfil.');
          this.enviando.set(false);
        }
      });
    } else {
      let imagenFinal = this.form.controls.imagenPerfil.value.trim();
      if (!imagenFinal || imagenFinal.startsWith('data:image')) {
        imagenFinal = avatarAleatorio(false);
      }
      this.ejecutarRegistro(imagenFinal);
    }
  }

  private ejecutarRegistro(imagenFinal: string): void {
    const datos = this.form.getRawValue();
    datos.imagenPerfil = imagenFinal;

    this.administradores.crear(datos).subscribe({
      next: (respuesta) => {
        this.enviando.set(false);
        this.mensajeExito.set(respuesta.mensaje);
        this.form.reset();
        this.archivoAvatar.set(null);
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