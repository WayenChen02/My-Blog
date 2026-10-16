# Kafka 架构是怎么样的？
## Kafka 架构
- **主题（topic）**: 消息的分类单位，每条消息都必须属于一个主题。
- **分区（partition）**: 每个主题可以分为多个分区，分区是 Kafka 实现高吞吐量的关键。
- **生产者（producer）**: 负责向 Kafka 主题发送消息。
- **消费者（consumer）**: 从 Kafka 主题读取消息。
- **消费者组（consumer group）**: 多个消费者可以组成一个消费者组，共同消费一个主题的消息。
- **Broker**: Kafka 集群中的服务器节点称为 Broker。
- **Zookeeper**: Kafka 使用 Zookeeper 来管理集群元数据和协调服务。从Kafka2.8.0开始，kafka引入kRaft协议，拜托了对Zookeeper的依赖。