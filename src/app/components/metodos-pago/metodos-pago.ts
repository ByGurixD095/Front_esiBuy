import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  MetodoPago,
  MetodosPagoService,
  RegistrarMetodoPagoRequest,
  TipoMetodoPago,
} from '../../services/metodos-pago-service/metodos-pago';
import { MarcoPagina } from '../marco-pagina/marco-pagina';

type DatosFormularioMetodoPago = {
  tipo: TipoMetodoPago;
  alias: string;
  nombreTitular: string;
  numeroTarjeta: string;
  caducidadMes: string;
  caducidadAnio: string;
  cvc: string;
  correoPayPal: string;
  prefijoBizum: string;
  telefonoBizum: string;
};

const NO_VACIO = /\S/;
const NUMERO_TARJETA = /^\d(?:[ -]?\d){12,18}$/;
const NUMERO_TARJETA_O_REFERENCIA = /^(?:\d(?:[ -]?\d){12,18}|\*{4} ?\d{4})$/;
const CVC = /^\d{3,4}$/;
const TELEFONO = /^\d(?:[\s()-]?\d){7,11}$/;
const TELEFONO_INTERNACIONAL = /^\+?\d{9,15}$/;
const MESES = [
  { valor: '01', nombre: 'Enero' },
  { valor: '02', nombre: 'Febrero' },
  { valor: '03', nombre: 'Marzo' },
  { valor: '04', nombre: 'Abril' },
  { valor: '05', nombre: 'Mayo' },
  { valor: '06', nombre: 'Junio' },
  { valor: '07', nombre: 'Julio' },
  { valor: '08', nombre: 'Agosto' },
  { valor: '09', nombre: 'Septiembre' },
  { valor: '10', nombre: 'Octubre' },
  { valor: '11', nombre: 'Noviembre' },
  { valor: '12', nombre: 'Diciembre' },
];
const PREFIJOS_TELEFONICOS = [
  { valor: '+34', pais: 'España' },
  { valor: '+351', pais: 'Portugal' },
  { valor: '+33', pais: 'Francia' },
  { valor: '+49', pais: 'Alemania' },
  { valor: '+39', pais: 'Italia' },
  { valor: '+44', pais: 'Reino Unido' },
  { valor: '+1', pais: 'Estados Unidos / Canadá' },
];

@Component({
  selector: 'app-metodos-pago',
  imports: [MarcoPagina, ReactiveFormsModule, RouterLink],
  templateUrl: './metodos-pago.html',
  styleUrl: './metodos-pago.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetodosPagoComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly metodosPagoService = inject(MetodosPagoService);

  readonly metodos = signal<MetodoPago[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly errorListado = signal('');
  readonly errorRegistro = signal('');
  readonly mensajeExito = signal('');
  readonly mensajeEliminacion = signal('');
  readonly errorEliminacion = signal('');
  readonly metodoPendienteEliminar = signal<MetodoPago | null>(null);
  readonly eliminando = signal(false);
  readonly metodoEnEdicion = signal<MetodoPago | null>(null);
  readonly mesesCaducidad = MESES;
  readonly prefijosTelefonicos = PREFIJOS_TELEFONICOS;
  readonly aniosCaducidad = Array.from(
    { length: 16 },
    (_, indice) => new Date().getFullYear() + indice,
  );

  readonly form = new FormGroup({
    tipo: new FormControl<TipoMetodoPago>('TARJETA', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    alias: new FormControl('', { nonNullable: true }),
    nombreTitular: new FormControl('', { nonNullable: true }),
    numeroTarjeta: new FormControl('', { nonNullable: true }),
    caducidadMes: new FormControl('', { nonNullable: true }),
    caducidadAnio: new FormControl('', { nonNullable: true }),
    cvc: new FormControl('', { nonNullable: true }),
    correoPayPal: new FormControl('', { nonNullable: true }),
    prefijoBizum: new FormControl('+34', { nonNullable: true }),
    telefonoBizum: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.actualizarValidadores(this.form.controls.tipo.value);
    this.cargar();
  }

  cambiarTipo(): void {
    const tipo = this.form.controls.tipo.value;
    this.form.controls.nombreTitular.reset('');
    this.form.controls.numeroTarjeta.reset('');
    this.form.controls.caducidadMes.reset('');
    this.form.controls.caducidadAnio.reset('');
    this.form.controls.cvc.reset('');
    this.form.controls.correoPayPal.reset('');
    this.form.controls.prefijoBizum.setValue('+34');
    this.form.controls.telefonoBizum.reset('');
    this.actualizarValidadores(tipo, this.metodoEnEdicion() !== null);
    this.errorRegistro.set('');
    this.mensajeExito.set('');
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorListado.set('');
    this.metodosPagoService.listar().subscribe({
      next: (metodos) => {
        this.metodos.set(metodos);
        this.cargando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorListado.set(
          this.auth.errorMessage(error, 'No se han podido cargar tus métodos de pago.'),
        );
        this.cargando.set(false);
      },
    });
  }

  registrar(): void {
    if (this.guardando() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const datos = this.form.getRawValue();
    const metodoEnEdicion = this.metodoEnEdicion();
    if (metodoEnEdicion) {
      this.modificar(metodoEnEdicion, datos);
      return;
    }

    const marcaTarjeta = datos.tipo === 'TARJETA' ? this.marcaTarjeta(datos.numeroTarjeta) : '';
    const ultimosCuatro =
      datos.tipo === 'TARJETA' ? datos.numeroTarjeta.replace(/\D/g, '').slice(-4) : '';
    const aliasPredeterminado =
      datos.tipo === 'TARJETA'
        ? `${marcaTarjeta} •••• ${ultimosCuatro}`
        : datos.tipo === 'PAYPAL'
          ? 'PayPal'
          : 'Bizum';
    const alias = datos.alias.trim() || aliasPredeterminado;
    const datosRegistro =
      datos.tipo === 'TARJETA'
        ? {
            tipo: datos.tipo,
            alias,
            titular: datos.nombreTitular.trim(),
            numeroTarjeta: this.referenciaTarjeta(datos.numeroTarjeta),
            caducidad: this.formatearCaducidad(datos.caducidadMes, datos.caducidadAnio),
          }
        : datos.tipo === 'PAYPAL'
          ? {
              tipo: datos.tipo,
              alias,
              titular: alias,
              correoPayPal: datos.correoPayPal.trim(),
            }
          : {
              tipo: datos.tipo,
              alias,
              titular: alias,
              telefonoBizum: `${datos.prefijoBizum}${datos.telefonoBizum.replace(/\D/g, '')}`,
            };

    if (datos.tipo === 'TARJETA') {
      this.form.controls.numeroTarjeta.reset('');
      this.form.controls.cvc.reset('');
    }
    this.guardando.set(true);
    this.errorRegistro.set('');
    this.mensajeExito.set('');
    this.metodosPagoService.registrar(datosRegistro).subscribe({
      next: (metodo) => {
        this.metodos.update((metodos) => [metodo, ...metodos]);
        this.errorListado.set('');
        this.form.reset({
          tipo: 'TARJETA',
          alias: '',
          nombreTitular: '',
          numeroTarjeta: '',
          caducidadMes: '',
          caducidadAnio: '',
          cvc: '',
          correoPayPal: '',
          prefijoBizum: '+34',
          telefonoBizum: '',
        });
        this.actualizarValidadores('TARJETA');
        this.guardando.set(false);
        this.mensajeExito.set(
          `¡Método guardado! «${metodo.alias}» ya aparece en tus métodos de pago.`,
        );
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorRegistro.set(
          this.auth.errorMessage(error, 'No se ha podido registrar el método de pago.'),
        );
      },
    });
  }

  iniciarEdicion(metodo: MetodoPago): void {
    const [caducidadMes = '', caducidadAnio = ''] = (metodo.caducidad ?? '').split('/');
    this.metodoEnEdicion.set(metodo);
    this.errorRegistro.set('');
    this.mensajeExito.set('');
    this.form.reset({
      tipo: metodo.tipo,
      alias: metodo.alias,
      nombreTitular: metodo.titular ?? '',
      numeroTarjeta: metodo.tipo === 'TARJETA' ? metodo.referencia : '',
      caducidadMes,
      caducidadAnio: caducidadAnio.length === 2 ? `20${caducidadAnio}` : caducidadAnio,
      cvc: '',
      correoPayPal: metodo.tipo === 'PAYPAL' ? metodo.referencia : '',
      prefijoBizum: '+34',
      telefonoBizum: metodo.tipo === 'BIZUM' ? metodo.referencia : '',
    });
    this.actualizarValidadores(metodo.tipo, true);
  }

  cancelarEdicion(): void {
    this.metodoEnEdicion.set(null);
    this.errorRegistro.set('');
    this.mensajeExito.set('');
    this.form.reset({
      tipo: 'TARJETA',
      alias: '',
      nombreTitular: '',
      numeroTarjeta: '',
      caducidadMes: '',
      caducidadAnio: '',
      cvc: '',
      correoPayPal: '',
      prefijoBizum: '+34',
      telefonoBizum: '',
    });
    this.actualizarValidadores('TARJETA', false);
  }

  private modificar(
    metodo: MetodoPago,
    datos: DatosFormularioMetodoPago,
  ): void {
    const marcaTarjeta = datos.tipo === 'TARJETA' ? this.marcaTarjeta(datos.numeroTarjeta) : '';
    const ultimosCuatro =
      datos.tipo === 'TARJETA' ? datos.numeroTarjeta.replace(/\D/g, '').slice(-4) : '';
    const aliasPredeterminado =
      datos.tipo === 'TARJETA'
        ? `${marcaTarjeta} •••• ${ultimosCuatro}`
        : datos.tipo === 'PAYPAL'
          ? 'PayPal'
          : 'Bizum';
    const alias = datos.alias.trim() || aliasPredeterminado;
    const datosModificacion: RegistrarMetodoPagoRequest =
      datos.tipo === 'TARJETA'
        ? {
            tipo: datos.tipo,
            alias,
            titular: datos.nombreTitular.trim(),
            numeroTarjeta: this.referenciaTarjeta(datos.numeroTarjeta),
            caducidad: this.formatearCaducidad(datos.caducidadMes, datos.caducidadAnio),
          }
        : datos.tipo === 'PAYPAL'
          ? {
              tipo: datos.tipo,
              alias,
              titular: alias,
              correoPayPal: datos.correoPayPal.trim(),
            }
          : {
              tipo: datos.tipo,
              alias,
              titular: alias,
              telefonoBizum: this.metodoEnEdicion()
                ? datos.telefonoBizum.replace(/\s/g, '')
                : `${datos.prefijoBizum}${datos.telefonoBizum.replace(/\D/g, '')}`,
            };

    if (datos.tipo === 'TARJETA') {
      this.form.controls.numeroTarjeta.setValue(datosModificacion.numeroTarjeta ?? '');
      this.form.controls.cvc.reset('');
    }
    this.guardando.set(true);
    this.errorRegistro.set('');
    this.mensajeExito.set('');
    this.metodosPagoService.modificar(metodo.id, datosModificacion).subscribe({
      next: (metodoModificado) => {
        this.metodos.update((metodos) =>
          metodos.map((actual) => (actual.id === metodo.id ? metodoModificado : actual)),
        );
        this.guardando.set(false);
        this.cancelarEdicion();
        this.mensajeExito.set(`Se ha actualizado «${metodoModificado.alias}» correctamente.`);
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errorRegistro.set(
          this.auth.errorMessage(error, 'No se ha podido modificar el método de pago.'),
        );
      },
    });
  }

  solicitarEliminacion(metodo: MetodoPago): void {
    this.errorEliminacion.set('');
    this.mensajeEliminacion.set('');
    this.metodoPendienteEliminar.set(metodo);
  }

  cancelarEliminacion(): void {
    if (!this.eliminando()) {
      this.metodoPendienteEliminar.set(null);
      this.errorEliminacion.set('');
    }
  }

  confirmarEliminacion(): void {
    const metodo = this.metodoPendienteEliminar();
    if (!metodo || this.eliminando()) {
      return;
    }

    this.eliminando.set(true);
    this.errorEliminacion.set('');
    this.metodosPagoService.eliminar(metodo.id).subscribe({
      next: () => {
        this.metodos.update((metodos) => metodos.filter((item) => item.id !== metodo.id));
        if (this.metodoEnEdicion()?.id === metodo.id) {
          this.cancelarEdicion();
        }
        this.metodoPendienteEliminar.set(null);
        this.mensajeEliminacion.set(`Se ha eliminado «${metodo.alias}» correctamente.`);
        this.eliminando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorEliminacion.set(
          this.auth.errorMessage(error, 'No se ha podido eliminar el método de pago.'),
        );
        this.eliminando.set(false);
      },
    });
  }

  esInvalido(
    campo:
      | 'nombreTitular'
      | 'numeroTarjeta'
      | 'caducidadMes'
      | 'caducidadAnio'
      | 'cvc'
      | 'correoPayPal'
      | 'telefonoBizum',
  ): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || control.dirty);
  }

  esCaducidadInvalida(): boolean {
    return (
      this.form.hasError('caducada') &&
      (this.form.controls.caducidadMes.touched ||
        this.form.controls.caducidadAnio.touched ||
        this.form.controls.caducidadMes.dirty ||
        this.form.controls.caducidadAnio.dirty)
    );
  }

  private actualizarValidadores(tipo: TipoMetodoPago, editando = false): void {
    const controles = this.form.controls;
    const camposActivos =
      tipo === 'TARJETA'
        ? [
            'nombreTitular',
            'numeroTarjeta',
            'caducidadMes',
            'caducidadAnio',
            ...(editando ? [] : ['cvc']),
          ]
        : tipo === 'PAYPAL'
          ? ['correoPayPal']
          : ['telefonoBizum'];

    for (const [nombre, control] of Object.entries(controles)) {
      if (nombre === 'tipo') {
        continue;
      }
      control.setValidators(
        camposActivos.includes(nombre) ? this.validadoresPara(nombre, editando) : [],
      );
      control.updateValueAndValidity({ emitEvent: false });
    }
    this.form.setValidators(tipo === 'TARJETA' ? this.noCaducada : null);
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private validadoresPara(campo: string, editando = false) {
    switch (campo) {
      case 'nombreTitular':
        return [Validators.required, Validators.pattern(NO_VACIO)];
      case 'numeroTarjeta':
        return [
          Validators.required,
          Validators.pattern(editando ? NUMERO_TARJETA_O_REFERENCIA : NUMERO_TARJETA),
        ];
      case 'caducidadMes':
        return [Validators.required];
      case 'caducidadAnio':
        return [Validators.required];
      case 'cvc':
        return [Validators.required, Validators.pattern(CVC)];
      case 'correoPayPal':
        return [Validators.required, Validators.email];
      case 'telefonoBizum':
        return [
          Validators.required,
          Validators.pattern(editando ? TELEFONO_INTERNACIONAL : TELEFONO),
        ];
      default:
        return [];
    }
  }

  private readonly noCaducada = (control: AbstractControl): ValidationErrors | null => {
    const month = Number(control.get('caducidadMes')?.value);
    const year = Number(control.get('caducidadAnio')?.value);
    if (!month || !year) {
      return null;
    }
    const ahora = new Date();
    const vigente =
      year > ahora.getFullYear() || (year === ahora.getFullYear() && month >= ahora.getMonth() + 1);
    return vigente ? null : { caducada: true };
  };

  private referenciaTarjeta(numero: string): string {
    const ultimosCuatro = numero.replace(/\D/g, '').slice(-4);
    return `**** ${ultimosCuatro}`;
  }

  private formatearCaducidad(mes: string, anio: string): string {
    return `${mes}/${anio}`;
  }

  private marcaTarjeta(numero: string): string {
    const digits = numero.replace(/\D/g, '');
    if (/^4/.test(digits)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
    if (/^3[47]/.test(digits)) return 'American Express';
    if (/^(6011|65|64[4-9])/.test(digits)) return 'Discover';
    return 'Tarjeta';
  }

  nombreTipo(tipo: TipoMetodoPago): string {
    switch (tipo) {
      case 'TARJETA':
        return 'Tarjeta';
      case 'PAYPAL':
        return 'PayPal';
      case 'BIZUM':
        return 'Bizum';
    }
  }

  estaCaducada(caducidad: string): boolean {
    const [mes, anio] = caducidad.split('/').map(Number);
    const ahora = new Date();
    return (
      anio < ahora.getFullYear() || (anio === ahora.getFullYear() && mes < ahora.getMonth() + 1)
    );
  }

  mostrarReferenciaTarjeta(alias: string): boolean {
    return !/^(Visa|Mastercard|American Express|Discover|Tarjeta) •••• \d{4}$/.test(alias);
  }

  referenciaVisible(referencia: string, tipo: TipoMetodoPago): string {
    const coincidencia = referencia.match(/^\*{4}\s?(\d{4})$/);
    if (coincidencia) {
      return `•••• ${coincidencia[1]}`;
    }

    if (tipo === 'PAYPAL') {
      const separador = referencia.lastIndexOf('@');
      if (separador <= 0 || separador === referencia.length - 1) {
        return '••••••';
      }
      return `${referencia[0]}•••••${referencia.slice(separador)}`;
    }

    if (tipo === 'BIZUM') {
      const ultimosTres = referencia.replace(/\D/g, '').slice(-3);
      return ultimosTres ? `••• ••• ${ultimosTres}` : '••••••';
    }

    return referencia;
  }
}
