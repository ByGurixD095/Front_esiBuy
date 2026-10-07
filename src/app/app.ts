import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  ChangeDetectionStrategy
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

interface Particle {
  x: number;
  y: number;
  z: number;
  radius: number;
  speed: number;
  accent: boolean;
}

interface Projected {
  x: number;
  y: number;
  scale: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class App implements AfterViewInit, OnDestroy {
  @ViewChild('renderCanvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number | null = null;

  private rotY = 0;
  private rotX = 0;
  private targetRotX = 0;
  private targetRotY = 0;

  private particles: Particle[] = [];

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    this.ctx = context;

    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);

    this.initParticles();

    this.ngZone.runOutsideAngular(() => {
      this.renderLoop();
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private onResize = () => {
    this.resizeCanvas();
  };

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  public onMouseMove(event: MouseEvent): void {
    const normX = (event.clientX / window.innerWidth) * 2 - 1;
    const normY = (event.clientY / window.innerHeight) * 2 - 1;
    this.targetRotY = normX * 0.3;
    this.targetRotX = -normY * 0.2;
  }

  private initParticles(): void {
    const count = 170;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: (Math.random() - 0.5) * 900,
        y: (Math.random() - 0.5) * 800,
        z: (Math.random() - 0.5) * 700,
        radius: Math.random() * 3.5 + 1.8, // Antes: 0.5 a 2.3 -> Ahora: 1.8 a 5.3px
        speed: Math.random() * 0.5 + 0.2,
        accent: Math.random() < 0.18
      });
    }
  }

  private renderLoop = (): void => {
    this.update();
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  private update(): void {
    this.rotY += 0.0015;
    this.rotX += (this.targetRotX - this.rotX) * 0.05;

    for (const p of this.particles) {
      p.y -= p.speed;
      if (p.y < -400) {
        p.y = 400;
      }
    }
  }

  private project(point: Particle, cx: number, cy: number, fov = 450): Projected {
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const x1 = point.x * cosY + point.z * sinY;
    const z1 = -point.x * sinY + point.z * cosY;

    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);
    const y2 = point.y * cosX - z1 * sinX;
    const z2 = point.y * sinX + z1 * cosX;

    const cameraDist = 520;
    const distance = z2 + cameraDist;
    const scale = distance > 0 ? fov / distance : 0;

    return {
      x: cx + x1 * scale,
      y: cy + y2 * scale,
      scale
    };
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    ctx.clearRect(0, 0, width, height);

    for (const p of this.particles) {
      const proj = this.project(p, cx, cy);
      if (proj.scale <= 0) continue;

      const currentRadius = Math.max(1.2, p.radius * proj.scale);
      const alpha = Math.min(Math.max(proj.scale * 0.8, 0.35), 0.95);

      ctx.beginPath();
      ctx.arc(proj.x, proj.y, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = p.accent
        ? `rgba(251, 191, 36, ${alpha})`
        : `rgba(125, 211, 252, ${alpha})`;
      ctx.fill();
    }
  }
}
