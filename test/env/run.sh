docker-compose -p microscopictest build && docker-compose -p microscopictest up -d

TEST_EXIT_CODE=`docker wait microscopictest_microscopic-rabbitmq-transport_1`

docker logs microscopictest_microscopic-rabbitmq-transport_1

rm -rf ${PWD}/../../coverage
docker cp microscopictest_microscopic-rabbitmq-transport_1:/tmp/testenv/coverage ${PWD}/../../coverage

docker-compose -p microscopictest kill
docker-compose -p microscopictest rm -f

exit $TEST_EXIT_CODE
