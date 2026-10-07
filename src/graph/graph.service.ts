// src/graph/graph.service.ts
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';

interface ComputeServiceGrpc {
  execute(data: {
    algorithm: string;
    graph: {
      vertices: number;
      edges: Array<{ from: number; to: number; weight: number }>;
      source: number;
    };
    includeSteps: boolean;
    target?: number;
  }): Observable<{
    status: string;
    resultJson: string;
    stepsJson: string;
    error: string;
  }>;
}

@Injectable()
export class GraphService implements OnModuleInit {
  private computeService: ComputeServiceGrpc;

  constructor(@Inject('COMPUTE_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    // Получаем gRPC-сервис по имени из proto ('ComputeService')
    this.computeService = this.client.getService<ComputeServiceGrpc>('ComputeService');
  }

  async runComputation(algorithm: string, graphData: any, target?: number) {
    // Вызываем метод Execute, который написан в Rust
    return this.computeService.execute({
      algorithm,
      graph: graphData,
      includeSteps: true,
      target,
    });
  }
}
