# 系统说明

本节概述项目中的主要系统与职责：

- SlotSystem：负责老虎机轮盘、结果解析与奖励分配。
- BulletSystem：子弹实体的生成、移动与碰撞逻辑。
- EnemySystem：敌人生成、路径与行为树/状态机管理。
- HUDSystem：界面显示、浮动文本与分数/货币展示。
- FXSystem：视觉特效与粒子效果管理（pixi-filters 集成）。
- RTPManager / ResultBank：负责赔率、结果记录与支付逻辑（模拟 RTP）。

每个系统的实现文件位于 `src/systems/`，更多实现细节见 `docs/` 下的对应文档文件。