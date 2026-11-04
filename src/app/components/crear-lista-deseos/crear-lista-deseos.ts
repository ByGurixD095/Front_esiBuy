import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ListaDeseos,
  ListaDeseosApiError,
  ListaDeseosService,
} from '../../services/lista-deseos-service/lista-deseos';
import { MarcoPagina } from '../marco-pagina/marco-pagina';

const NO_VACIO = /\S/;

@Component({
  selector: 'app-crear-lista-deseos',
  imports: [ReactiveFormsModule, RouterLink, MarcoPagina],
  templateUrl: './crear-lista-deseos.html',
  styleUrl: './crear-lista-deseos.css',
})
export class CrearListaDeseos {
  private readonly listasDeseos = inject(ListaDeseosService);

  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly listaCreada = signal<ListaDeseos | null>(null);
  readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(NO_VACIO)],
    }),
  });

  crear(): void {
    if (this.enviando()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const nombre = this.form.controls.nombre.value.trim();
    this.error.set(null);
    this.listaCreada.set(null);
    this.enviando.set(true);

    this.listasDeseos.crear(nombre).subscribe({
      next: (lista) => {
        this.listaCreada.set(lista);
        this.enviando.set(false);
        this.form.reset();
      },
      error: (error: ListaDeseosApiError) => {
        this.error.set(error.message);
        this.enviando.set(false);
      },
    });
  }
}
