import { Router, Request, Response } from 'express';
import { getRepository } from '@/config/database';
import { ArbitrageOpportunity } from '@/models';

const router = Router();

/**
 * Get current opportunities
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const opportunityRepository = getRepository(ArbitrageOpportunity);
    const opportunities = await opportunityRepository.find({
      where: { status: 'detected' },
      relations: ['tokenPair', 'sourceExchange', 'targetExchange'],
      order: { detectedAt: 'DESC' },
      take: 50
    });

    res.json({
      success: true,
      data: opportunities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch opportunities'
    });
  }
});

/**
 * Get opportunity by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const opportunityRepository = getRepository(ArbitrageOpportunity);
    const opportunity = await opportunityRepository.findOne({
      where: { id },
      relations: ['tokenPair', 'sourceExchange', 'targetExchange', 'trades']
    });

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: 'Opportunity not found'
      });
    }

    res.json({
      success: true,
      data: opportunity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch opportunity'
    });
  }
});

export { router as opportunityRoutes };
