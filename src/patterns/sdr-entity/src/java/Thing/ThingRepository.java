public interface ThingRepository extends CrudRepository<ThingEntity, Long> {
    List<ThingEntity> findByShape(String shape);
    List<ThingEntity> findByColor(String color);
}