import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { AiHistory } from '../interfaces/ai-history.interface';
import { Subscription, take } from 'rxjs';
import { AiService } from '../services/ai.service';

interface SimHistory {
  model: string;
  content: string;
}

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    ReactiveFormsModule,
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
})
export class MainComponent implements OnInit {
  @ViewChild('chat') chatBox!: ElementRef;
  systemConfigForm!: FormGroup;
  aiMessageBuffer = '';
  loading = false;
  simHistory: SimHistory[] = [];
  simGemmaHistory: AiHistory[] = [];
  simOrcaHistory: AiHistory[] = [];
  currentModel = 'gemma:2b';
  gemma = 'gemma:2b';
  orca = 'orca-mini:3b';
  startAiSim = false;
  defaultGemmaBehavior =
    'Your name is Gemma, introduce yourself as such and start a casual fun conversation. Try to keep the conversation going.';
  defaultOrcaBehavior =
    'Your name is Orca, introduce yourself as such and start a casual fun conversation. Try to keep the conversation going.';
  serverMessage = '';
  scrollTop = 0;
  streamSubscription!: Subscription;

  constructor(private cdRef: ChangeDetectorRef, private aiService: AiService) {}

  ngOnInit() {
    this.systemConfigForm = new FormGroup({
      gemmaBehavior: new FormControl(this.defaultGemmaBehavior, [
        Validators.required,
      ]),
      orcaBehavior: new FormControl(this.defaultOrcaBehavior, [
        Validators.required,
      ]),
    });

    this.streamSubscription = this.aiService.getMessages().subscribe(
      (message: any) => {
        message = JSON.parse(message) || null;
        if (message) {
          this.loading = false;
          this.currentModel = message.model;
        }
        if (this.startAiSim === true) {
          if (message && message.done === false) {
            this.aiMessageBuffer += message.message.content;
          } else if (message && message.done === true) {
            this.simHistory.push({
              model: message.model,
              content: this.aiMessageBuffer,
            });

            if (message.model === this.gemma) {
              //orca asked or first ask
              this.simGemmaHistory.push({
                role: 'assistant',
                content: this.aiMessageBuffer,
              });
              this.simOrcaHistory.push({
                // gemma response is user for orca
                role: 'user',
                content: this.aiMessageBuffer,
              });
              this.aiMessageBuffer = ''; //reset

              //send to orca
              this.sendToAiSim(this.orca, this.simOrcaHistory);
            } else if (message.model === this.orca) {
              //gemma asked
              this.simGemmaHistory.push({
                //orca response is user for gemma
                role: 'user',
                content: this.aiMessageBuffer,
              });
              this.simOrcaHistory.push({
                role: 'assistant',
                content: this.aiMessageBuffer,
              });
              this.aiMessageBuffer = ''; //reset

              //send to gemma
              this.sendToAiSim(this.gemma, this.simGemmaHistory);
            }
          }
          this.cdRef.detectChanges();
          this.scrollTop = this.chatBox.nativeElement.scrollHeight;
        }
      },
      (error) => {
        console.log(error);
        this.serverMessage = 'Error connecting to retrieve server-side-events.';
      }
    );
  }

  async startSim(gemmaBehavior: string | null, orcaBehavior: string | null) {
    this.startAiSim = true;
    this.loading = true;
    //set Orca behavior
    this.simOrcaHistory.push({
      role: 'system',
      content: orcaBehavior ?? this.defaultOrcaBehavior,
    });
    //set gemma behavior
    this.simGemmaHistory.push({
      role: 'system',
      content: gemmaBehavior ?? this.defaultGemmaBehavior,
    });
    //prompt gemma first
    this.currentModel = this.gemma;
    this.aiService
      .sendMessage(this.gemma, [
        {
          role: 'system',
          content: gemmaBehavior ?? this.defaultGemmaBehavior,
        },
      ])
      .pipe(take(1))
      .subscribe({
        error: (error) => {
          console.log(error);
          this.serverMessage = error.message;
        },
      });
  }

  async sendToAiSim(model: string, history: AiHistory[]) {
    if (this.loading === false && this.startAiSim === true) {
      this.loading = true;
      this.currentModel = model;
      this.cdRef.detectChanges();
      this.scrollTop = this.chatBox.nativeElement.scrollHeight;
      this.aiService
        .sendMessage(model, history)
        .pipe(take(1))
        .subscribe({
          error: (error) => {
            console.log(error);
            this.serverMessage = error.message;
          },
        });
    }
  }

  onSubmit() {
    this.serverMessage = '';
    if (this.systemConfigForm.valid) {
      this.startSim(
        this.systemConfigForm.get('gemmaBehavior')?.value,
        this.systemConfigForm.get('orcaBehavior')?.value
      );
    }
  }

  stopSim() {
    this.serverMessage = '';
    this.startAiSim = false;
    this.loading = false;
    this.aiMessageBuffer = '';
    this.simGemmaHistory = [];
    this.simOrcaHistory = [];
    this.simHistory = [];
  }

  ngOnDestroy(): void {
    this.streamSubscription && this.streamSubscription.unsubscribe();
  }
}
