import { Component, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MarcoPagina } from '../compartido/marco-pagina/marco-pagina';

@Component({
  selector: 'app-inicio-sesion',
  imports: [ReactiveFormsModule, MarcoPagina],
  templateUrl: './inicio-sesion.html',
  styleUrl: './inicio-sesion.css',
})
export class InicioSesion {
  // Mismos nombres que espera el back en POST /users/login
  readonly iniciarSesion = output<{ username: string; password: string }>();

  readonly form = new FormGroup({
    usuario: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    contrasena: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly mostrarContrasena = signal(false);

  alternarContrasena(): void {
    this.mostrarContrasena.update((visible) => !visible);
  }

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { usuario, contrasena } = this.form.getRawValue();
    this.iniciarSesion.emit({ username: usuario, password: contrasena });
  }
}