import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DireccionEnvio } from '../../services/pedidos.service';
import { DireccionGuardada, DireccionesService } from '../../services/direcciones.service';
import { MarcoPagina } from '../marco-pagina/marco-pagina';

@Component({
  selector: 'app-direcciones',
  imports: [MarcoPagina, ReactiveFormsModule, RouterLink],
  templateUrl: './direcciones.html',
  styleUrl: './direcciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DireccionesComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly direccionesService = inject(DireccionesService);

  readonly direcciones = signal<DireccionGuardada[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly eliminandoId = signal<string | null>(null);
  readonly editando = signal<DireccionGuardada | null>(null);
  readonly pendienteEliminar = signal<DireccionGuardada | null>(null);
  readonly error = signal('');
  readonly mensaje = signal('');

  readonly form = new FormGroup({
    nombreCompleto: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)],
    }),
    direccion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(200)],
    }),
    ciudad: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
    provincia: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
    codigoPostal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(20)],
    }),
    pais: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    }),
    telefono: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(30)],
    }),
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.direccionesService.listar().subscribe({
      next: (direcciones) => {
        this.direcciones.set(direcciones);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.auth.errorMessage(error, 'No se han podido cargar tus direcciones.'));
        this.cargando.set(false);
      },
    });
  }

  editar(direccion: DireccionGuardada): void {
    this.editando.set(direccion);
    this.mensaje.set('');
    this.error.set('');
    this.form.setValue({
      nombreCompleto: direccion.nombreCompleto,
      direccion: direccion.direccion,
      ciudad: direccion.ciudad,
      provincia: direccion.provincia,
      codigoPostal: direccion.codigoPostal,
      pais: direccion.pais,
      telefono: direccion.telefono,
    });
  }

  cancelarEdicion(): void {
    this.editando.set(null);
    this.form.reset();
    this.error.set('');
    this.mensaje.set('');
  }

  guardar(): void {
    if (this.guardando() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const direccion: DireccionEnvio = {
      nombreCompleto: valores.nombreCompleto.trim(),
      direccion: valores.direccion.trim(),
      ciudad: valores.ciudad.trim(),
      provincia: valores.provincia.trim(),
      codigoPostal: valores.codigoPostal.trim(),
      pais: valores.pais.trim(),
      telefono: valores.telefono.trim(),
    };
    const actual = this.editando();
    this.guardando.set(true);
    this.error.set('');
    this.mensaje.set('');

    const peticion = actual
      ? this.direccionesService.actualizar(actual.id, direccion)
      : this.direccionesService.crear(direccion);
    peticion.subscribe({
      next: (guardada) => {
        this.direcciones.update((direcciones) =>
          actual
            ? direcciones.map((item) => (item.id === guardada.id ? guardada : item))
            : [guardada, ...direcciones],
        );
        this.guardando.set(false);
        this.cancelarEdicion();
        this.mensaje.set(actual ? 'La dirección se ha actualizado.' : 'La dirección se ha guardado.');
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(this.auth.errorMessage(error, 'No se ha podido guardar la dirección.'));
      },
    });
  }

  solicitarEliminacion(direccion: DireccionGuardada): void {
    this.pendienteEliminar.set(direccion);
  }

  cancelarEliminacion(): void {
    this.pendienteEliminar.set(null);
  }

  confirmarEliminacion(): void {
    const direccion = this.pendienteEliminar();
    if (!direccion || this.eliminandoId()) return;

    this.pendienteEliminar.set(null);
    this.eliminandoId.set(direccion.id);
    this.error.set('');
    this.mensaje.set('');
    this.direccionesService.eliminar(direccion.id).subscribe({
      next: () => {
        this.direcciones.update((actuales) => actuales.filter((item) => item.id !== direccion.id));
        this.eliminandoId.set(null);
        if (this.editando()?.id === direccion.id) this.cancelarEdicion();
        this.mensaje.set('La dirección se ha eliminado.');
      },
      error: (error: HttpErrorResponse) => {
        this.eliminandoId.set(null);
        this.error.set(this.auth.errorMessage(error, 'No se ha podido eliminar la dirección.'));
      },
    });
  }

  esInvalido(campo: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }
}
