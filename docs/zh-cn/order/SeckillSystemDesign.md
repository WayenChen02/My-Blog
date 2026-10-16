# 秒杀系统设计

## 设计目标

秒杀系统的核心目标是：

- **抗住高并发**：应对瞬时流量峰值
- **防止库存超卖**：确保商品库存准确无误

## 整体架构

采用分层设计，通过层层限流削峰，将99%的无效流量挡在系统外，同时通过Redis+lua以及数据库兜底来保证商品不超卖。

## 详细设计

### 1. 前端层（第一道防线）

**核心策略**：

- **按钮置灰**：禁止重复提交
- **滑块验证码**：将流量打散，增加用户操作时间
- **随机丢弃**：用户提交后随机丢弃部分请求，直接返回秒杀失败请重试

**目标**：挡住大部分无效流量，减轻后端压力

### 2. 网关层（第二道防线）

**核心策略**：

- **IP限流**：对用户IP做秒级限流，例如1秒钟最多允许5次请求
- **请求拦截**：超过限流阈值的请求直接返回"请求过于频繁请稍后重试"
- **黑名单**：针对高频恶意请求IP、黄牛账号直接拉黑

**目标**：将前端没挡住的恶意请求、超量请求拦截在业务服务之外

### 3. 服务层（核心削峰层）

**核心策略**：只让有效请求继续往下走，通过Redis+lua脚本实现用户一人只能购买一次，防止库存超卖。

**具体步骤**：

#### i. 活动预热

- 在秒杀开始前30秒，将秒杀的库存、活动时间等信息提前预热到Redis
- 如果活动时间还没开始，请求直接快速失败

#### ii. Redis+lua脚本处理

- **判断用户是否已抢购**：检查用户是否有扣减流水，如有则直接快速失败
- **库存检查**：判断库存是否充足
- **扣减库存**：如果库存充足，扣减库存
- **添加流水**：记录用户抢购成功信息

#### iii. 异步处理

- 将用户ID、商品ID、购买数量等信息包装成消息发送到MQ
- 异步写入数据库，减少同步操作带来的性能压力

#### iv. 数据库兜底

- 数据底层通过条件：`可售库存-已收库存>=购买数量`进行兜底
- 如果数据库扣减库存失败，不弥补Redis的库存，默认库存已经售卖
- 允许少卖，优先保证不超卖

## 技术实现细节

### Redis+lua脚本

使用Lua脚本确保库存检查和扣减的原子性：

```lua
if redis.call('hexists', KEYS[2], ARGV[2]) == 1 then
    return redis.error_reply('OPERATION_ALREADY_EXECUTED')
end
                
local current = redis.call('get', KEYS[1])
if current == false then
    return redis.error_reply('KEY_NOT_FOUND')
end
if tonumber(current) == nil then
    return redis.error_reply('current value is not a number')
end
if tonumber(current) == 0 then
    return redis.error_reply('INVENTORY_IS_ZERO')
end
if tonumber(current) < tonumber(ARGV[1]) then
    return redis.error_reply('INVENTORY_NOT_ENOUGH')
end
                
local new = tonumber(current) - tonumber(ARGV[1])
redis.call('set', KEYS[1], tostring(new))
                
-- 获取Redis服务器的当前时间（秒和微秒）
local time = redis.call("time")
-- 转换为毫秒级时间戳
local currentTimeMillis = (time[1] * 1000) + math.floor(time[2] / 1000)
                
-- 使用哈希结构存储日志
redis.call('hset', KEYS[2], ARGV[2], cjson.encode({
    action = "decrease",
    from = current,
    to = new,
    change = ARGV[1],
    by = ARGV[2],
    timestamp = currentTimeMillis
}))
                
return new
```

### 消息队列

使用消息队列（如RocketMQ、Kafka）实现异步处理：
- 削峰填谷，缓解瞬时压力
- 确保数据最终一致性
- 提高系统可靠性

### 数据库优化

- **索引优化**：为秒杀相关表建立合适的索引
- **批量处理**：异步批量写入数据库
- **事务控制**：使用乐观锁或悲观锁确保库存扣减的原子性

## 系统监控与告警

- **实时监控**：监控系统QPS、响应时间、错误率等指标
- **告警机制**：设置合理的告警阈值，及时发现并处理异常
- **流量分析**：分析流量特征，优化限流策略

## 容灾与降级

- **降级策略**：当系统压力过大时，优先保证核心功能
- **容灾方案**：多活部署，确保系统高可用
- **应急措施**：准备应急方案，应对突发情况

## 总结

秒杀系统设计的核心在于：
1. **层层限流**：通过前端、网关、服务层的多层限流，将无效流量挡在系统外
2. **原子操作**：使用Redis+lua脚本确保库存检查和扣减的原子性
3. **异步处理**：通过消息队列实现异步写入，提高系统吞吐量
4. **多层兜底**：数据库兜底确保最终一致性，优先保证不超卖

通过以上设计，可以构建一个高性能、高可用的秒杀系统，既能够抗住瞬时高并发，又能够防止库存超卖，为用户提供良好的秒杀体验。