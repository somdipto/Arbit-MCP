import { Router, Request, Response } from 'express';
import { priceMonitoringService } from '@/services/PriceMonitoringService';
import { mcpService } from '@/services/MCPService';

const router = Router();

/**
 * Get system status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = {
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV,
      priceMonitoring: priceMonitoringService.getStatus(),
      mcp: await mcpService.checkHealth(),
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system status'
    });
  }
});

export { router as systemRoutes };
