import { Router, Request, Response } from 'express';
import { getRepository } from '@/config/database';
import { Trade } from '@/models';

const router = Router();

/**
 * Get trade history
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tradeRepository = getRepository(Trade);
    const trades = await tradeRepository.find({
      relations: ['opportunity', 'wallet'],
      order: { createdAt: 'DESC' },
      take: 50
    });

    res.json({
      success: true,
      data: trades
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trades'
    });
  }
});

/**
 * Get trade by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tradeRepository = getRepository(Trade);
    const trade = await tradeRepository.findOne({
      where: { id },
      relations: ['opportunity', 'wallet', 'verification']
    });

    if (!trade) {
      return res.status(404).json({
        success: false,
        error: 'Trade not found'
      });
    }

    res.json({
      success: true,
      data: trade
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trade'
    });
  }
});

export { router as tradeRoutes };
